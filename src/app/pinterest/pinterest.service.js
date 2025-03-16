import { NotFoundException } from "../../exceptions/notFound.exception.js";
import { puppeteerService } from "../../services/puppeteer.service.js";
import { PinterestUtility } from "./pinterest.utility.js";
import { BadRequestException } from "../../exceptions/badRequest.exception.js";
import { configs } from "../../configs/configs.js";

export class PinterestService {
  constructor() {
    this.pinterestUtility = new PinterestUtility();
    this.puppeteerService = puppeteerService;
  }

  getPreview = async (url) => {
    if (!this.pinterestUtility.isValidPinterestUrl(url)) {
      throw new BadRequestException("Invalid Pinterest URL!");
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

    await page.close();

    if (!mediaProps) {
      throw new NotFoundException("Preview Image Not Found!");
    }

    return mediaProps;
  };

  downloadVideo = async (url) => {
    const { videoUrl, audioUrl } = await this.pinterestUtility.getVideoAudioUrls(url);

    const result = await this.pinterestUtility.downloadHlsVideo({
      videoUrl,
      audioUrl,
      tempDir: configs.TEMP_DIR,
    });

    return result;
  };
}
