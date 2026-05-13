const express = require("express");

const {
  createSupportRequest,
  addSupportMessage,
  listSupportRequests,
  updateSupportRequest,
} = require("./supportController");
const SupportArticle = require("./SupportArticle");
const { requireAuth } = require("../../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, listSupportRequests);
router.get("/articles/search", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = { status: "published" };
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { body: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ];
    }
    const articles = await SupportArticle.find(filter).sort({ updatedAt: -1 }).limit(30);
    res.status(200).json(articles.map((article) => ({
      id: String(article._id),
      slug: article.slug,
      title: article.title,
      category: article.category,
      excerpt: article.body.slice(0, 240),
      tags: article.tags,
      updatedAt: article.updatedAt,
    })));
  } catch (error) {
    next(error);
  }
});
router.post("/articles", requireAuth, async (req, res, next) => {
  try {
    if (!["admin", "admin_player"].includes(req.user.role)) return res.status(403).json({ message: "Admin access required" });
    const { slug, title, category = "general", body, tags = [], status = "published" } = req.body;
    if (!slug || !title || !body) return res.status(400).json({ message: "slug, title, and body are required" });
    const article = await SupportArticle.findOneAndUpdate(
      { slug },
      { slug, title, category, body, tags, status, updatedBy: req.user.userId },
      { upsert: true, new: true }
    );
    res.status(201).json({ id: String(article._id), slug: article.slug, title: article.title });
  } catch (error) {
    next(error);
  }
});
router.post("/", requireAuth, createSupportRequest);
router.patch("/:requestId", requireAuth, updateSupportRequest);
router.post("/:requestId/messages", requireAuth, addSupportMessage);

module.exports = router;
