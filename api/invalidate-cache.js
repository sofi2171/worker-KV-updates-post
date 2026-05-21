export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    // 1. لاگ ان چیک کریں
    const authHeader = req.headers.authorization || "";
    if (!authHeader) return res.status(401).json({ error: "Missing Auth Header" });

    try {
        const { slug, postId, updatedData } = req.body;

        // 2. ویری ایبلز کی جانچ (یہاں پتہ چلے گا کہ کیا ڈیٹا خالی آ رہا ہے)
        if (!process.env.ADMIN_SECRET) throw new Error("Environment Variable ADMIN_SECRET is missing on Server");
        if (!process.env.CLOUDFLARE_WORKER_URL) throw new Error("CLOUDFLARE_WORKER_URL is missing");

        // 3. کلاؤڈ فلیر ورکر کو کال کریں
        const targetUrl = `${process.env.CLOUDFLARE_WORKER_URL}/api/invalidate-cache`;
        
        const cfRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-admin-secret": process.env.ADMIN_SECRET 
            },
            body: JSON.stringify({ slug: slug || "unknown-slug" })
        });

        // 4. رسپانس کا تجزیہ
        const responseText = await cfRes.text();
        
        if (!cfRes.ok) {
            // یہاں آپ کو واضح پتہ چلے گا کہ ورکر کیوں فیل ہوا (403, 404, یا 500)
            return res.status(cfRes.status).json({ 
                error: "Cloudflare Worker Error", 
                status: cfRes.status,
                rawResponse: responseText 
            });
        }

        return res.status(200).json({ success: true, message: "Cache cleared", workerResponse: responseText });

    } catch (err) {
        // 5. اگر کوڈ میں کوئی بھی ایرر (جیسے نیٹ ورک فیل ہونا) ہوا تو یہاں سے پتہ چلے گا
        console.error("Backend Error Detail:", err);
        return res.status(500).json({ 
            error: "Internal Server Error", 
            message: err.message,
            stack: err.stack // یہ آپ کو بتائے گا کہ کس لائن پر کوڈ ٹوٹا
        });
    }
}
