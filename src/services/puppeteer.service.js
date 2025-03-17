import fs from "fs";
import puppeteer from "puppeteer";

class PuppeteerService {
  constructor() {
    if (!PuppeteerService.instance) {
      this.browserInstance = null;
      this.pagePool = [];
      PuppeteerService.instance = this;
    }
    return PuppeteerService.instance;
  }

  async launch() {
    if (!this.browserInstance) {
      const executablePath = "./.cache/puppeteer/chrome/linux-134.0.6998.35/chrome-linux64/chrome";

      this.browserInstance = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.ENV === "prod" ? executablePath : "",
      });
    }
    return this.browserInstance;
  }

  async getNewPage() {
    if (this.pagePool.length > 0) {
      return this.pagePool.pop();
    }
    const newPage = await this.browserInstance.newPage();
    await newPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    return newPage;
  }

  async releasePage(page) {
    await page.goto("about:blank");
    this.pagePool.push(page);
  }

  async close() {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }
}

export const puppeteerService = new PuppeteerService();
