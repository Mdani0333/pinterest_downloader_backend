import fs from "fs";
import path from "path";
import axios from "axios";
import { exec } from "child_process";
import { Parser } from "m3u8-parser";
import ffmpegPath from "ffmpeg-static";
import { puppeteerService } from "../../services/puppeteer.service.js";
import { tokenUtility } from "../../utils/token.utility.js";
import { NotFoundException } from "../../exceptions/notFound.exception.js";
import { cacheService } from "../../services/caching.service.js";

export class PinterestUtility {
  constructor() {
    this.puppeteerService = puppeteerService;
    this.tokenUtility = tokenUtility;
    this.cacheService = cacheService;
  }

  isValidPinterestUrl = (url) => {
    const pinterestUrlPattern = /^https?:\/\/(www\.|in\.)?pinterest\.com\/pin\/\d+/;
    return pinterestUrlPattern.test(url);
  };

  getVideoAudioUrls = async (url) => {
    const cachedResult = this.cacheService.get(`video/audio:${url}`);

    if (cachedResult) {
      return cachedResult;
    }

    const page = await this.puppeteerService.getNewPage();

    let videoUrl = null;
    let audioUrl = null;

    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes(".m3u8")) {
        if (url.includes("_audio.m3u8")) {
          audioUrl = url;
        } else {
          videoUrl = url;
        }
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    this.puppeteerService.releasePage(page);

    if (!videoUrl) {
      throw new NotFoundException("No video HLS playlist found!");
    }

    this.cacheService.set(`video/audio:${url}`, { videoUrl, audioUrl });

    return {
      videoUrl,
      audioUrl,
    };
  };

  downloadSegments = async (m3u8Url, type, tempDir) => {
    const { data: m3u8Content } = await axios.get(m3u8Url);

    const parser = new Parser();
    parser.push(m3u8Content);
    parser.end();

    const segments = parser.manifest.segments;
    if (!segments || segments.length === 0) {
      throw new Error(`No segments found in the ${type} HLS playlist`);
    }

    const segmentFiles = await Promise.all(
      segments.map(async (segment, i) => {
        const segmentUrl = new URL(segment.uri, m3u8Url).href;
        const segmentFilePath = path.join(tempDir, `${type}_segment_${i}.ts`);
        const { data: segmentData } = await axios.get(segmentUrl, {
          responseType: "arraybuffer",
        });
        fs.writeFileSync(segmentFilePath, segmentData);
        return segmentFilePath;
      })
    );

    return segmentFiles;
  };

  writeSegmentsToFile = async (segmentFiles, writeStream) => {
    for (const segmentFile of segmentFiles) {
      const segmentData = fs.readFileSync(segmentFile);
      writeStream.write(segmentData);
      fs.unlinkSync(segmentFile); // Delete the segment file after writing
    }
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
  };

  mergeVideoAudio = (videoPath, audioPath, outputPath) => {
    return new Promise((resolve, reject) => {
      const command = `${ffmpegPath} -i ${videoPath} -i ${audioPath} -c:v copy -c:a aac -y ${outputPath}`;
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          console.error("Error merging video and audio:", err);
          reject(err);
        } else {
          console.log("Merging complete:", outputPath);
          resolve(outputPath);
        }
      });
    });
  };

  downloadHlsVideo = async ({ videoUrl, audioUrl, tempDir }) => {
    const uniqueID = await this.tokenUtility.generateHashedUUIDToken();
    tempDir = path.join(tempDir, uniqueID);
    fs.mkdirSync(tempDir);

    const [videoSegmentFiles, audioSegmentFiles] = await Promise.all([
      this.downloadSegments(videoUrl, "video", tempDir),
      audioUrl
        ? this.downloadSegments(audioUrl, "audio", tempDir)
        : Promise.resolve([]),
    ]);

    const videoOutputFilePath = path.join(tempDir, "video.mp4");
    const audioOutputFilePath = audioUrl
      ? path.join(tempDir, "audio.aac")
      : null;

    await Promise.all([
      this.writeSegmentsToFile(
        videoSegmentFiles,
        fs.createWriteStream(videoOutputFilePath)
      ),
      audioOutputFilePath
        ? this.writeSegmentsToFile(
            audioSegmentFiles,
            fs.createWriteStream(audioOutputFilePath)
          )
        : Promise.resolve(),
    ]);

    console.log(`Video file created: ${videoOutputFilePath}`);
    if (audioOutputFilePath) {
      console.log(`Audio file created: ${audioOutputFilePath}`);
    }

    const finalOutputFilePath = path.join(tempDir, "output.mp4");
    if (audioOutputFilePath) {
      await this.mergeVideoAudio(
        videoOutputFilePath,
        audioOutputFilePath,
        finalOutputFilePath
      );
    } else {
      fs.renameSync(videoOutputFilePath, finalOutputFilePath);
    }

    return {
      outputPath: finalOutputFilePath,
      folderUsed: tempDir,
    };
  };

  cleanupTempFiles = async (tempDir) => {
    if (!fs.existsSync(tempDir)) {
      console.log(`Directory does not exist: ${tempDir}`);
      return;
    }

    const files = await fs.promises.readdir(tempDir);

    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(tempDir, file);
        const stat = await fs.promises.stat(filePath);

        if (stat.isFile()) {
          await fs.promises.unlink(filePath);
          console.log(`File deleted: ${filePath}`);
        } else if (stat.isDirectory()) {
          await cleanupTempFiles(filePath);
        }
      })
    );

    await fs.promises.rmdir(tempDir);
  };
}
