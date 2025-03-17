import fs from "fs";
import path from "path";

export const streamFileWithProgress = (filePath, res, onProgress) => {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    let downloadedSize = 0;

    const readStream = fs.createReadStream(filePath);

    // Set headers for the download
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filePath)}"`
    );

    // Stream the file to the client
    readStream.on("data", (chunk) => {
      downloadedSize += chunk.length;
      const progress = ((downloadedSize / fileSize) * 100).toFixed(2);
      onProgress(progress); // Send progress to the client
    });

    readStream.pipe(res);

    readStream.on("end", () => {
      resolve();
    });

    readStream.on("error", (err) => {
      reject(err);
    });
  });
};
