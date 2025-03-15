import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

class TokenUtility {
  constructor() {
    if (!TokenUtility.instance) {
      TokenUtility.instance = this;
    }

    return TokenUtility.instance;
  }

  generateHexToken = async () => {
    return crypto.randomBytes(32).toString("hex");
  };

  generateUUIDToken = async () => {
    return uuidv4();
  };

  generateHashedUUIDToken = async () => {
    const uuid = uuidv4();
    const hash = crypto.createHash("sha256").update(uuid).digest("hex");
    return hash.substring(0, 16);
  };
}

export const tokenUtility = new TokenUtility();
