import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async (req, res) => {
  //build a healthcheck response that simply returns the OK status as json with a message
  try {
    // Check database connection
    await mongoose.connection.db.admin().ping();
    console.log("Database connection healthy");

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          version: "1.0.0", 
          uptime: process.uptime(), //uptime in seconds
        },
        "OK - Database connected"
      )
    );
  } catch (error) {
    console.error("Database connection failed:", error);
    throw new ApiError(503, "Service Unavailable - Database connection failed");
  }
});

export { healthcheck };
