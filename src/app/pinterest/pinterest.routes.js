import express from "express";
import { PinterestController } from "./pinterest.controller.js";

const router = express.Router();

const pinterestController = new PinterestController();

router.get("/preview", pinterestController.getPreview);

router.post("/download", pinterestController.downloadVideo);

export { router as PinterestRoutes };
