import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN, // Allow requests from this origin
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));// limit the size of the request body to 16KB
app.use(express.urlencoded({ extended: true, limit: "16kb" }));//Middleware to parse URL-encoded data from forms in incoming requests
app.use(express.static("public")); // Serve static files from the "public" directory such as images, CSS, and JavaScript files.
app.use(cookieParser()); // Middleware to parse cookies from incoming requests, allowing the server to read and manage client-stored cookies.


export { app };
