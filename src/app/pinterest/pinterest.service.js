import { NotFoundException } from "../../exceptions/notFound.exception.js";
import { puppeteerService } from "../../services/puppeteer.service.js";
import { PinterestUtility } from "./pinterest.utility.js";
import { BadRequestException } from "../../exceptions/badRequest.exception.js";
import { configs } from "../../configs/configs.js";
import { cacheService } from "../../services/caching.service.js";
import { streamFileWithProgress } from "../../utils/stream.utility.js";

export class PinterestService {
  constructor() {
    this.pinterestUtility = new PinterestUtility();
    this.puppeteerService = puppeteerService;
    this.cacheService = cacheService
  }

  getPreview = async (req, res) => {
    const { url } = req.query;

    if (!this.pinterestUtility.isValidPinterestUrl(url)) {
      throw new BadRequestException("Invalid Pinterest URL!");
    }

    const cachedResult = this.cacheService.get(`preview:${url}`);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        message: "Preview Image fetched successfully!",
        data: cachedResult,
      });
    }

    const page = await this.puppeteerService.getNewPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    const mediaProps = await page.evaluate(() => {
      const videoElement = document.querySelector("video");
      if (videoElement && videoElement.poster) {
        return { mediaType: "video", previewImageUrl: videoElement.poster };
      }

      const gifElement = document.querySelector('img[src*=".gif"]');
      if (gifElement && gifElement.src) {
        return { mediaType: "gif", previewImageUrl: gifElement.src };
      }

      const imageElement = document.querySelector("img");
      if (imageElement && imageElement.src) {
        return { mediaType: "image", previewImageUrl: imageElement.src };
      }

      return null;
    });

    await this.puppeteerService.releasePage(page);

    if (!mediaProps) {
      throw new NotFoundException("Preview Image Not Found!");
    }

    mediaProps.size = await this.pinterestUtility.fetchMediaSize(mediaProps.previewImageUrl);

    this.cacheService.set(`preview:${url}`, mediaProps);

    return res.status(200).json({
      success: true,
      message: "Preview Image fetched successfully!",
      data: mediaProps,
    });
  };

  downloadVideo = async (req, res) => {
    const { url } = req.body;

    const { videoUrl, audioUrl } = await this.pinterestUtility.getVideoAudioUrls(url);

    const result = await this.pinterestUtility.downloadHlsVideo({
      videoUrl,
      audioUrl,
      tempDir: configs.TEMP_DIR,
    });

    await streamFileWithProgress(result.outputPath, res);

    this.pinterestUtility.cleanupTempFiles(result.folderUsed)
  };
}
