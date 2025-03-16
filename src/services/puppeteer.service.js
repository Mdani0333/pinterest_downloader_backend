import puppeteer from "puppeteer";

class PuppeteerService {
  constructor() {
    if (!PuppeteerService.instance) {
      this.browserInstance = null;
      PuppeteerService.instance = this;
    }
    return PuppeteerService.instance;
  }

  async launch() {
    if (!this.browserInstance) {
      this.browserInstance = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        ...(process.env.ENV === "prod" ?? { executablePath: "/usr/bin/google-chrome-stable" })
      });
    }
    return this.browserInstance;
  }

  async getNewPage() {
    const newPage = await this.browserInstance.newPage();
    await newPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    return newPage;
  }

  async close() {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }
}

export const puppeteerService = new PuppeteerService();