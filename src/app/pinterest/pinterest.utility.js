import fs from "fs";
import path from "path";
import axios from "axios";
import { exec } from "child_process";
import { Parser } from "m3u8-parser";
import ffmpegPath from "ffmpeg-static";
import { puppeteerService } from "../../services/puppeteer.service.js";
import { tokenUtility } from "../../utils/token.utility.js";
import { NotFoundException } from "../../exceptions/notFound.exception.js";

export class PinterestUtility {
  constructor() {
    this.puppeteerService = puppeteerService;
    this.tokenUtility = tokenUtility;
  }

  isValidPinterestUrl = (url) => {
    const pinterestUrlPattern =
      /^https?:\/\/(www\.|in\.)?pinterest\.com\/pin\/\d+/;
    return pinterestUrlPattern.test(url);
  };

  getVideoAudioUrls = async (url) => {
    const page = await this.puppeteerService.getNewPage();

    let videoUrl = null;
    let audioUrl = null;

    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes(".m3u8")) {
        if (url.includes("_audio.m3u8")) {
          console.log("Intercepted m3u8 audioURL:", url);
          audioUrl = url;
        }

        console.log("Intercepted m3u8 videoURL:", url);
        videoUrl = url;
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.close();

    if (!videoUrl) {
      throw new NotFoundException("No video HLS playlist found!");
    }

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

    const segmentFiles = [];

    for (let i = 0; i < segments.length; i++) {
      const segmentUrl = new URL(segments[i].uri, m3u8Url).href;
      const segmentFilePath = path.join(tempDir, `${type}_segment_${i}.ts`);
      const { data: segmentData } = await axios.get(segmentUrl, {
        responseType: "arraybuffer",
      });
      fs.writeFileSync(segmentFilePath, segmentData);
      segmentFiles.push(segmentFilePath);
    }

    return segmentFiles;
  };

  mergeVideoAudio = (videoPath, audioPath, outputPath) => {
    return new Promise((resolve, reject) => {
      const command = `${ffmpegPath} -i ${videoPath} -i ${audioPath} -c:v copy -c:a aac ${outputPath}`;

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

    const videoSegmentFiles = await this.downloadSegments(
      videoUrl,
      "video",
      tempDir
    );

    console.log("Audio URL:", audioUrl);

    let audioSegmentFiles = [];

    if (audioUrl) {
      audioSegmentFiles = await this.downloadSegments(
        audioUrl,
        "audio",
        tempDir
      );
    }

    const videoOutputFilePath = path.join(tempDir, "video.mp4");

    const videoWriteStream = fs.createWriteStream(videoOutputFilePath);

    await new Promise((resolve, reject) => {
      for (const segmentFile of videoSegmentFiles) {
        const segmentData = fs.readFileSync(segmentFile);
        videoWriteStream.write(segmentData);
        fs.unlinkSync(segmentFile);
      }

      videoWriteStream.end();

      videoWriteStream.on("finish", () => {
        console.log(`Video file created: ${videoOutputFilePath}`);
        resolve();
      });

      videoWriteStream.on("error", (err) => {
        console.error("Error writing video file:", err);
        reject(err);
      });
    });

    let audioOutputFilePath = null;

    if (audioSegmentFiles.length > 0) {
      audioOutputFilePath = path.join(tempDir, "audio.aac");

      const audioWriteStream = fs.createWriteStream(audioOutputFilePath);

      await new Promise((resolve, reject) => {
        for (const segmentFile of audioSegmentFiles) {
          const segmentData = fs.readFileSync(segmentFile);
          audioWriteStream.write(segmentData);
          fs.unlinkSync(segmentFile);
        }

        audioWriteStream.end();

        audioWriteStream.on("finish", () => {
          console.log(`Audio file created: ${audioOutputFilePath}`);
          resolve();
        });

        audioWriteStream.on("error", (err) => {
          console.error("Error writing audio file:", err);
          reject(err);
        });
      });
    }

    const finalOutputFilePath = path.join(tempDir, "output.mp4");

    if (audioOutputFilePath) {
      await this.mergeVideoAudio(
        videoOutputFilePath,
        audioOutputFilePath,
        finalOutputFilePath
      );
    } else {
      if (fs.existsSync(videoOutputFilePath)) {
        fs.renameSync(videoOutputFilePath, finalOutputFilePath);
      } else {
        throw new NotFoundException(
          `Video file not found: ${videoOutputFilePath}`
        );
      }
    }

    if (fs.existsSync(videoOutputFilePath)) {
      fs.unlinkSync(videoOutputFilePath);
    }

    if (audioOutputFilePath && fs.existsSync(audioOutputFilePath)) {
      fs.unlinkSync(audioOutputFilePath);
    }

    return {
      outputPath: finalOutputFilePath,
      folderUsed: tempDir,
    };
  };
}
