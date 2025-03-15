import { PinterestService } from "./pinterest.service.js";

export class PinterestController {
  constructor() {
    this.pinterestService = new PinterestService();
  }

  getPreview = async (req, res, next) => {
    try {
      const { url } = req.query;

      const mediaProps = await this.pinterestService.getPreview(url);

      return res.status(200).json({
        success: true,
        message: "Preview Image fetched successfully!",
        data: mediaProps,
      });
    } catch (error) {
      next(error);
    }
  };

  downloadVideo = async (req, res, next) => {
    try {
      const { url } = req.body;

      const outputPath = await this.pinterestService.downloadVideo(url);

      return res.sendFile(outputPath);
    } catch (error) {
      next(error);
    }
  };
}
