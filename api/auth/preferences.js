const {
    getAuthenticatedUser,
    getPool,
    readJson,
    sendJson,
    validatePreferences
} = require('../../lib/auth');

module.exports = async function preferences(req, res) {
    if (req.method !== 'PUT') {
        res.setHeader('Allow', 'PUT');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Authentication required' });
        }

        const body = await readJson(req);
        const hasPreferences = body.dailyRoutine !== undefined || body.daily_routine !== undefined ||
            body.outdoorTime !== undefined || body.outdoor_time !== undefined ||
            body.weatherInterests !== undefined || body.weather_interests !== undefined ||
            body.weatherUse !== undefined || body.weather_use !== undefined ||
            body.secondaryActivities !== undefined || body.secondary_activities !== undefined;
        const validation = hasPreferences ? validatePreferences(body, false) : { value: null };
        if (validation.error) return sendJson(res, 400, { error: validation.error });

        const city = typeof body.locationCity === 'string' ? body.locationCity.trim() : typeof body.location_city === 'string' ? body.location_city.trim() : '';
        const latitude = Number(body.latitude ?? body.locationLatitude ?? body.location_latitude);
        const longitude = Number(body.longitude ?? body.locationLongitude ?? body.location_longitude);
        const secondaryActivities = body.secondaryActivities ?? body.secondary_activities;
        if (secondaryActivities !== undefined && (!Array.isArray(secondaryActivities) || secondaryActivities.some(activity => typeof activity !== 'string'))) {
            return sendJson(res, 400, { error: 'Secondary activities are invalid' });
        }
        const hasLocation = city && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
        if (!validation.value && !hasLocation) return sendJson(res, 400, { error: 'Preferences or a valid location is required' });

        const values = validation.value;
        await getPool().execute(
            `UPDATE users
             SET daily_routine = COALESCE(?, daily_routine),
                 outdoor_time = COALESCE(?, outdoor_time),
                 weather_interests = COALESCE(?, weather_interests),
                 weather_use = COALESCE(?, weather_use),
                 secondary_activities = COALESCE(?, secondary_activities),
                 location_city = COALESCE(?, location_city),
                 location_latitude = COALESCE(?, location_latitude),
                 location_longitude = COALESCE(?, location_longitude),
                 onboarding_completed = CASE
                     WHEN COALESCE(?, location_city) IS NOT NULL
                      AND COALESCE(?, location_latitude) IS NOT NULL
                      AND COALESCE(?, location_longitude) IS NOT NULL
                      AND COALESCE(?, daily_routine) <> 'pending'
                      AND COALESCE(?, outdoor_time) <> 'pending'
                      AND COALESCE(?, weather_use) <> 'pending'
                     THEN TRUE ELSE onboarding_completed END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?`,
            [
                values && values.dailyRoutine || null,
                values && values.outdoorTime || null,
                values && JSON.stringify(values.weatherInterests) || null,
                values && values.weatherUse || null,
                secondaryActivities !== undefined ? JSON.stringify(secondaryActivities) : null,
                hasLocation ? city : null,
                hasLocation ? latitude : null,
                hasLocation ? longitude : null,
                hasLocation ? city : null,
                hasLocation ? latitude : null,
                hasLocation ? longitude : null,
                values && values.dailyRoutine || null,
                values && values.outdoorTime || null,
                values && values.weatherUse || null,
                user.user_id
            ]
        );

        return sendJson(res, 200, { message: 'Preferences saved' });
    } catch (error) {
        if (error.statusCode) {
            return sendJson(res, error.statusCode, { error: error.message });
        }
        return sendJson(res, 500, { error: 'Unable to save preferences' });
    }
};
