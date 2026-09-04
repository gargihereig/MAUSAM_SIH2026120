function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

function getCoordinates(req) {
    const url = new URL(req.url, 'http://localhost');
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
    }
    return { lat, lon };
}

module.exports = async function airQuality(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const coordinates = getCoordinates(req);
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!coordinates) return sendJson(res, 400, { error: 'Valid latitude and longitude are required' });
    if (!apiKey) {
        console.error('[air-quality] missing OPENWEATHER_API_KEY');
        return sendJson(res, 503, { error: 'Weather service is not configured' });
    }

    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${apiKey}`);
        if (!response.ok) {
            const body = await response.text();
            console.error('[air-quality] upstream request failed', {
                status: response.status,
                statusText: response.statusText,
                body: body.slice(0, 500)
            });
            return sendJson(res, 502, { error: 'Air quality service failed' });
        }
        const payload = await response.json();
        const airQuality = payload && payload.list && payload.list[0] ? payload.list[0] : null;
        const components = airQuality && airQuality.components ? airQuality.components : {};
        const aqi = airQuality && airQuality.main && Number.isFinite(airQuality.main.aqi) ? airQuality.main.aqi : null;
        const labels = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };
        if (aqi === null) {
            console.error('[air-quality] response missing list[0].main.aqi', {
                hasList: Array.isArray(payload && payload.list),
                hasComponents: Boolean(components && Object.keys(components).length)
            });
            return sendJson(res, 502, { error: 'Air quality data unavailable' });
        }
        return sendJson(res, 200, {
            aqi,
            aqiLabel: labels[aqi] || 'Unavailable',
            pm25: Number.isFinite(components.pm2_5) ? components.pm2_5 : null,
            pm10: Number.isFinite(components.pm10) ? components.pm10 : null
        });
    } catch (error) {
        console.error('[air-quality] request failed', {
            name: error && error.name,
            code: error && error.code,
            message: error && error.message
        });
        return sendJson(res, 502, { error: 'Air quality service failed' });
    }
};
