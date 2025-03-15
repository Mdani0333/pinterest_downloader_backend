import chalk from "chalk";
import { performance } from "perf_hooks";
import { getCurrentTimestamp } from "../utils/date.utility.js";

export const RequestLogger = (req, res, next) => {
  const start = performance.now();
  const timestamp = getCurrentTimestamp();

  res.on("finish", () => {
    const duration = performance.now() - start;

    const method = colorMethod(req.method);
    const url = chalk.cyan(req.originalUrl);
    const status = colorStatus(res.statusCode);
    const time = chalk.yellow(`${duration.toFixed(2)}ms`);

    console.log(`${timestamp} - ${method} ${url} ${status} - ${time}`);
  });

  next();
};

const colorMethod = (method) => {
  switch (method) {
    case "GET":
      return chalk.green(method);
    case "POST":
      return chalk.yellow(method);
    case "PUT":
      return chalk.blue(method);
    case "DELETE":
      return chalk.red(method);
    case "PATCH":
      return chalk.magenta(method);
    case "OPTIONS":
      return chalk.gray(method);
    default:
      return chalk.white(method);
  }
};

const colorStatus = (status) => {
  if (status < 300) return chalk.green(status);
  if (status < 400) return chalk.cyan(status);
  if (status < 500) return chalk.yellow(status);
  return chalk.red(status);
};
