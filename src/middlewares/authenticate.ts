import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import constants from "../utils/constants";

// JWT authentication middleware for Express routes
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  // Retrieve the token from the headers
  const token = req.headers.authorization?.split(" ")[1]; // Assumes "Bearer <token>" format

  if (!token) {
    res.status(403).json({ message: "Authentication error: No token provided" });
    return;
  }

  try {
    // Verify the token
    const jwt_token = jwt.verify(token, constants.JWT_SECRET_KEY) as { auth_token?: string };

    // Check if the token contains the required auth_token
    if (jwt_token.auth_token && jwt_token.auth_token === constants.AUTH_TOKEN) {
      next(); // Proceed to the next middleware or route handler
    } else {
      throw new Error("Failed to match the decoded Auth Token");
    }
  } catch (error) {
    res.status(401).json({ message: "Authentication error: Invalid token" });
    return;
  }
};
