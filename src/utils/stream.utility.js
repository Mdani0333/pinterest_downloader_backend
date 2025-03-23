import fs from "fs";
import path from "path";

export const streamFileWithProgress = (filePath, res) => {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const readStream = fs.createReadStream(filePath);

    res.setHeader("Content-Length", fileSize);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filePath)}"`
    );

    readStream.pipe(res);

    readStream.on("end", () => {
      resolve();
    });

    readStream.on("error", (err) => {
      reject(err);
    });
  });
};
