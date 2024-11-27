import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { Redis } from "ioredis";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import router from "./routers/routes";
import constants from "./utils/constants";

// Initialize Express application
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Create a Redis connection for pub/sub and user mapping
export const pubClient = new Redis({
  host: constants.REDIS_HOST,
  port: constants.REDIS_PORT,
  db: constants.REDIS_DATABASE,
}).on("error", (err) => console.error("Redis PubClient Error:", err));

const subClient = pubClient.duplicate().on("error", (err) => console.error("Redis SubClient Error:", err));

// Set up Socket.IO with Redis adapter
export const io = new Server(httpServer, {
  adapter: createAdapter(pubClient, subClient),
  cors: {
    origin: constants.ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Redis key to store user socket mappings (userId -> socketId)
const userSocketMapKey = "user-socket-map";

// Middleware setup
app.use(express.json());
app.use(
  cors({
    origin: constants.ORIGIN,
  })
);

// Register routes
app.use(router);

// Middleware to authenticate Socket.IO connection
io.use(async (socket: Socket, next) => {
  try {
    // Assuming the token is passed in the query parameter of the handshake or authorization header
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];

    if (!token) {
      console.error(`Invalid token from IP: ${socket.handshake.address}, User-Agent: ${socket.handshake.headers['user-agent']}`);
      next(new Error('Authentication error: No token provided'));
    }

    // Validate token
    const jwt_token = jwt.verify(token, constants.JWT_SECRET_KEY) as { auth_token?: string };

    if (jwt_token.auth_token && jwt_token.auth_token === constants.AUTH_TOKEN) {
      // Proceed with the connection
      next();
    } else {
      throw new Error("Failed to match the decoded Auth Token")
    }
  } catch (error) {
    console.error('Authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Function to set user socket in Redis
const setUserSocketInRedis = async (userId: string, socketId: string) => {
  await pubClient.hset(userSocketMapKey, userId, socketId); // Store userId -> socketId in Redis
};

// Function to get user socket from Redis
const getUserSocketFromRedis = async (userId: string) => {
  return await pubClient.hget(userSocketMapKey, userId); // Get the socketId for a given userId
};

// Function to remove user socket from Redis when they disconnect
const removeUserSocketFromRedis = async (userId: string) => {
  await pubClient.hdel(userSocketMapKey, userId); // Remove userId from Redis
};

// Socket.IO connection handler
io.on("connect", (socket: Socket) => {
  console.log(`Connected ${socket.id}`);

  // Authenticate and store userId <-> socket mapping in Redis
  socket.on("authenticate", async (userId: string) => {
    await setUserSocketInRedis(userId, socket.id);
    console.log(`User authenticated with ID: ${userId}, socket: ${socket.id}`);
  });

  // Send message to specific user
  socket.on("ws-message", async ({ to, type, payload }) => {
    const targetSocketId = await getUserSocketFromRedis(to) as string;
    if (targetSocketId) {
      socket.to(targetSocketId).emit("ws-message", { type, payload });
      console.log(`Message sent to user ${to}!`);
    } else {
      await pubClient.publish("send-message", JSON.stringify({ to, type, payload }));
      console.log(`Message sent to user ${to} via Redis Pub/Sub!`)
    }
  });

  // Broadcast message to all users
  socket.on("broadcast-message", async ({ type, payload }) => {
    io.emit("broadcast-message", { type, payload });
    console.log(`Message broadcasted to all users!`);
  });

  // Handle user disconnect
  socket.on("disconnect", async () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Find and remove the user from Redis mapping
    for (let [userId, socketId] of Object.entries(await pubClient.hgetall(userSocketMapKey))) {
      if (socketId === socket.id) {
        await removeUserSocketFromRedis(userId);
        console.log(`User ${userId} removed from userSocketMap.`);
        break;
      }
    }
  });
});

// Listen for Redis Pub/Sub messages to handle cross-server communication
subClient.subscribe("send-message", (err, count) => {
  if (err) {
    console.error("Failed to subscribe to send-message channel:", err);
  } else {
    console.log(`Subscribed to ${count} channel(s).`);
  }
});

// Handle incoming Pub/Sub messages
subClient.on("message", async (channel, message) => {
  if (channel === "send-message") {
    const { to, type, payload } = JSON.parse(message);

    console.log(`Received Pub/Sub message for user ${to}: ${JSON.stringify(payload)}`);

    // Get the target socket ID for the user
    const targetSocketId = await getUserSocketFromRedis(to) as string;

    console.log(targetSocketId + " target socket id");

    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);

      if (targetSocket) {
        // Log that the socket is valid
        console.log(`Delivering message to socket ID ${targetSocketId}`);
        targetSocket.emit("ws-message", { type, payload });
        console.log(`Message delivered to user ${to}: ${JSON.stringify(payload)}`);
      } else {
        // Log if the socket ID is found but not connected
        console.log(`Socket ID ${targetSocketId} found but user is not connected.`);
      }
    } else {
      console.log(`Socket ID for user ${to} not found.`);
    }
  }
});

// Start the server
httpServer.listen(constants.PORT, () => {
  console.log(`Websockets server is running on ${constants.BASE_URL()}`);
});
