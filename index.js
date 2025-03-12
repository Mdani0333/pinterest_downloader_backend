import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";
import axios from "axios";
import { Parser } from "m3u8-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import ffmpegPath from "ffmpeg-static";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.post("/api/download", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const response = await getPinterestMedia(url);

    // If the media URL is an HLS playlist, download and combine the video
    if (response.mediaType === "video") {
      const videoFilePath = await downloadHlsVideo({
        videoUrl: response.videoUrl,
        audioUrl: response.audioUrl,
      });
      res.sendFile(videoFilePath); // Send the video file as a response
    } else {
      res.json({ mediaUrl: response.imageUrl }); // Send the direct media URL
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch media" });
  }
});

async function generateHashedUUIDToken() {
  const uuid = uuidv4();
  const hash = crypto.createHash("sha256").update(uuid).digest("hex");
  return hash.substring(0, 16);
}

async function getPinterestMedia(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  let videoUrl = null;
  let audioUrl = null;
  let imageUrl = null;

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

  await page.goto(url, { waitUntil: "networkidle2" });

  const isVideo = await page.evaluate(() => {
    return (
      !!document.querySelector("video") ||
      !!document.querySelector('[data-test-id="pin-video-player"]') ||
      !!document.querySelector('[data-test-id="PinVideoPlayer"]') ||
      document.documentElement.innerHTML.includes("video player")
    );
  });

  if (!isVideo) {
    imageUrl = await page.evaluate(() => {
      const imageElement = document.querySelector("img");
      if (imageElement && imageElement.src) {
        return imageElement.src;
      }

      const gifElement = document.querySelector('img[src*=".gif"]');
      if (gifElement && gifElement.src) {
        return gifElement.src;
      }

      return null;
    });
  }

  await browser.close();

  return {
    mediaType: isVideo ? "video" : "image",
    videoUrl,
    audioUrl,
    imageUrl,
  };
}

async function mergeVideoAudio(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    const command = `${ffmpegPath} -i ${videoPath} -i ${audioPath} -c:v copy -c:a aac ${outputPath}`;

    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error("Error merging video and audio:", err);
        reject(err);
      } else {
        console.log("Merging complete:", outputPath);
        resolve(outputPath);
      }
    });
  });
}

async function downloadHlsVideo({ videoUrl, audioUrl }) {
  // Create a temporary directory to store the .ts files
  const tempDir = path.join(__dirname, "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Function to download segments from a given .m3u8 URL
  const downloadSegments = async (m3u8Url, type) => {
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

  // Download video segments
  const videoSegmentFiles = await downloadSegments(videoUrl, "video");

  // Download audio segments if audioUrl is provided
  console.log("Audio URL:", audioUrl);
  let audioSegmentFiles = [];
  if (audioUrl) {
    audioSegmentFiles = await downloadSegments(audioUrl, "audio");
  }

  // Combine video segments into a single video file
  const video_filename = await generateHashedUUIDToken();
  const videoOutputFilePath = path.join(tempDir, `${video_filename}_video.mp4`);
  const videoWriteStream = fs.createWriteStream(videoOutputFilePath);

  await new Promise((resolve, reject) => {
    for (const segmentFile of videoSegmentFiles) {
      const segmentData = fs.readFileSync(segmentFile);
      videoWriteStream.write(segmentData);
      fs.unlinkSync(segmentFile); // Delete the segment file after combining
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

  // Combine audio segments into a single audio file (if audio exists)
  let audioOutputFilePath = null;
  if (audioSegmentFiles.length > 0) {
    const audio_filename = await generateHashedUUIDToken();
    audioOutputFilePath = path.join(tempDir, `${audio_filename}_audio.aac`);
    const audioWriteStream = fs.createWriteStream(audioOutputFilePath);

    await new Promise((resolve, reject) => {
      for (const segmentFile of audioSegmentFiles) {
        const segmentData = fs.readFileSync(segmentFile);
        audioWriteStream.write(segmentData);
        fs.unlinkSync(segmentFile); // Delete the segment file after combining
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

  const full_video_filename = await generateHashedUUIDToken();
  const finalOutputFilePath = path.join(
    tempDir,
    `${full_video_filename}_video_output.mp4`
  );

  if (audioOutputFilePath) {
    await mergeVideoAudio(
      videoOutputFilePath,
      audioOutputFilePath,
      finalOutputFilePath
    );
  } else {
    if (fs.existsSync(videoOutputFilePath)) {
      fs.renameSync(videoOutputFilePath, finalOutputFilePath);
    } else {
      throw new Error(`Video file not found: ${videoOutputFilePath}`);
    }
  }

  if (fs.existsSync(videoOutputFilePath)) {
    fs.unlinkSync(videoOutputFilePath);
  }

  if (audioOutputFilePath && fs.existsSync(audioOutputFilePath)) {
    fs.unlinkSync(audioOutputFilePath);
  }

  return finalOutputFilePath;
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
