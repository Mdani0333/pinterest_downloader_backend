import { PinterestService } from "./pinterest.service.js";

export class PinterestController {
  constructor() {
    this.pinterestService = new PinterestService();
  }

  getPreview = async (req, res, next) => {
    try {
      await this.pinterestService.getPreview(req, res);
    } catch (error) {
      next(error);
    }
  };

  downloadVideo = async (req, res, next) => {
    try {
      await this.pinterestService.downloadVideo(req, res);
    } catch (error) {
      next(error);
    }
  };
}
