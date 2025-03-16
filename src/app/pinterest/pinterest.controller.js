import fs from "fs";
import path from "path";
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

      const result = await this.pinterestService.downloadVideo(url);

      res.sendFile(result.outputPath, (err) => {
        if (err) {
          next(err);
        } else {
          fs.unlink(result.outputPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Failed to delete the file:", unlinkErr);
            } else {
              console.log("File deleted successfully:", result.outputPath);
              fs.rm(result.folderUsed, { recursive: true, force: true }, (rmErr) => {
                if (rmErr) {
                    console.error("Failed to delete the temp directory:", rmErr);
                } else {
                    console.log("Temp directory deleted successfully:", result.folderUsed);
                }
            });
            }
          });
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
