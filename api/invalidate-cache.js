export const config = {
    api: {
        bodyParser: true,
    },
};

export default async function handler(req, res) {

    res.setHeader("Access-Control-Allow-Origin", "https://healthjobportal.com");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "").trim();

    if (!idToken) return res.status(401).json({ error: "Unauthorized: No token" });

    try {
        // Firebase token verify
        const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken })
            }
        );

        const verifyData = await verifyRes.json();

        if (!verifyData.users || verifyData.users.length === 0) {
            return res.status(401).json({ error: "Unauthorized: Invalid token" });
        }

        const { slug } = req.body;

        if (!slug || typeof slug !== "string") {
            return res.status(400).json({ error: "Bad Request: slug required" });
        }

        // Cloudflare Worker کو server side سے call
        const cfRes = await fetch(
            `${process.env.CLOUDFLARE_WORKER_URL}/api/invalidate-cache`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-secret": process.env.ADMIN_SECRET
                },
                body: JSON.stringify({ slug })
            }
        );

        const cfData = await cfRes.json();

        if (!cfRes.ok) {
            return res.status(500).json({ error: "KV invalidation failed", detail: cfData });
        }

        return res.status(200).json({ success: true, message: `KV cache cleared for: ${slug}` });

    } catch (err) {
        console.error("invalidate-cache error:", err);
        return res.status(500).json({ error: "Internal Server Error", detail: err.message });
    }
}
