export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const authHeader = req.headers.authorization || "";
    if (!authHeader) return res.status(401).json({ error: "Missing Auth Header" });

    try {
        const { slug, postId, type } = req.body;

        if (!process.env.ADMIN_SECRET)
            throw new Error("ADMIN_SECRET missing");
        if (!process.env.CLOUDFLARE_WORKER_URL)
            throw new Error("CLOUDFLARE_WORKER_URL missing");

        // ── Clean slug — NO prefix, Worker khud add karta hai ────────────────
        const finalSlug = slug || postId || "unknown-slug";
        const targetUrl = `${process.env.CLOUDFLARE_WORKER_URL}/api/invalidate-cache`;

        const isUpdate  = type === "general_post";
        const isJob     = type === "employer_post" || type === "candidate_post";
        const clearBoth = !type || type === "both";

        // ── Worker ko call karo — clean slug bhejo ────────────────────────────
        const cfRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-admin-secret": process.env.ADMIN_SECRET
            },
            body: JSON.stringify({
                slug: finalSlug,       // ✅ sirf clean slug, koi prefix nahi
                type: type || "both"   // ✅ type bhej do taake Worker decide kare
            })
        });

        const text = await cfRes.text();

        if (!cfRes.ok) {
            return res.status(207).json({
                success: false,
                message: "Worker cache clear failed",
                workerStatus: cfRes.status,
                workerResponse: text
            });
        }

        return res.status(200).json({
            success: true,
            message: `Cache cleared for: ${finalSlug}`,
            type: type || "both",
            workerResponse: text
        });

    } catch (err) {
        console.error("Backend Error:", err);
        return res.status(500).json({
            error: "Internal Server Error",
            message: err.message
        });
    }
}
