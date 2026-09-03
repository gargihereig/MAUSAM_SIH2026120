const bcrypt = require('bcryptjs');
const {
    createSession,
    getPool,
    isValidCustomId,
    isValidEmail,
    normalizeCustomId,
    readJson,
    sendJson
} = require('../../lib/auth');

const INVALID_CREDENTIALS = 'Invalid email or password';

module.exports = async function login(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const body = await readJson(req);
        const customId = normalizeCustomId(body.customId || body.username || body.email);
        const password = typeof body.password === 'string' ? body.password : '';

        if ((!isValidCustomId(customId) && !isValidEmail(customId)) || !password) {
            return sendJson(res, 401, { error: INVALID_CREDENTIALS });
        }

        const [rows] = await getPool().execute(
                    `SELECT l.user_id, l.custom_id, l.password_hash, u.name,
                        u.daily_routine, u.outdoor_time, u.weather_interests, u.weather_use,
                        u.secondary_activities,
                        u.onboarding_completed, u.location_city,
                        u.location_latitude, u.location_longitude
             FROM login_data AS l
             JOIN users AS u ON u.user_id = l.user_id
             WHERE l.custom_id = ? OR l.email = ?`,
            [customId, customId]
        );
        const account = rows[0];
        const passwordMatches = account
            ? await bcrypt.compare(password, account.password_hash)
            : false;

        if (!account || !passwordMatches) {
            return sendJson(res, 401, { error: INVALID_CREDENTIALS });
        }

        await createSession(account.user_id, res);
        return sendJson(res, 200, {
            user: {
                user_id: account.user_id,
                name: account.name,
                customId: account.custom_id,
                onboardingCompleted: Boolean(account.onboarding_completed),
                location: account.location_city ? {
                    city: account.location_city,
                    latitude: Number(account.location_latitude),
                    longitude: Number(account.location_longitude)
                } : null,
                preferences: {
                    dailyRoutine: account.daily_routine,
                    outdoorTime: account.outdoor_time,
                    weatherInterests: account.weather_interests,
                    weatherUse: account.weather_use,
                    secondaryActivities: typeof account.secondary_activities === 'string'
                        ? JSON.parse(account.secondary_activities)
                        : (account.secondary_activities || [])
                }
            }
        });
    } catch (error) {
        if (error.statusCode) {
            return sendJson(res, error.statusCode, { error: error.message });
        }
        return sendJson(res, 500, { error: 'Unable to log in' });
    }
};
