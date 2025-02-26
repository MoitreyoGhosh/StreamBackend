import { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  // get all videos based on query, sort, pagination
  // Validate pagination parameters
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  if (isNaN(pageNumber) || pageNumber < 1) {
    throw new ApiError(400, "Invalid page number.");
  }

  if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    throw new ApiError(400, "Invalid limit. Must be between 1 and 100.");
  }

  const skip = (pageNumber - 1) * limitNumber;

  // Build the match stage for filtering videos based on the query and userId
  const matchStage = {
    $and: [],
  };

  if (query) {
    matchStage.$and.push({
      $or: [
        { title: { $regex: query, $options: "i" } }, //i for case insensitive, regex for regular expression
        { description: { $regex: query, $options: "i" } },
      ],
    });
  }

  if (userId) {
    // Filter by userId if provided
    matchStage.$and.push({ owner: userId });
  }

  // If there are no conditions, remove $and so the query returns all
  if (matchStage.$and.length === 0) {
    delete matchStage.$and;
  }

  // Build the sort stage
  const sortStage = {};
  if (sortBy) {
    sortStage[sortBy] = sortType === "asc" ? 1 : -1;
  } else {
    // Provide a default sort order (e.g., by creation date) if no sortBy is specified
    sortStage.createdAt = -1; // Sort by creation date descending by default
  }

  try {
    const videos = await Video.aggregate([
      // Match stage for filtering (if applicable)
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),

      // Lookup stage to fetch owner details
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "createdBy",
          pipeline: [
            {
              $project: {
                fullname: 1,
                username: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          createdBy: {
            $first: "$createdBy",
          },
        },
      },
      // Project required details
      {
        $project: {
          thumbnail: 1,
          videoFile: 1,
          title: 1,
          description: 1,
          owner: 1,
          createdBy: 1,
          views: 1,
          duration: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      // Sorting
      {
        $sort: sortStage,
      },
      // Pagination
      {
        $skip: skip,
      },
      {
        $limit: limitNumber,
      },
    ]);

    // Get total video count for pagination
    const totalVideos = await Video.countDocuments(
      matchStage.$and ? matchStage : {}
    ); // Account for match stages

    if (!videos?.length) {
      throw new ApiError(404, "No videos found");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          videos: videos,
          totalVideos: totalVideos,
          page: pageNumber,
          limit: limitNumber,
        },
        "Videos fetched successfully"
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      // If it's already an ApiError, just pass it along
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    // If it's a different type of error, create a generic ApiError
    console.error("Unexpected error fetching videos:", error);
    const genericError = new ApiError(
      500,
      "Failed to fetch videos due to an unexpected error.",
      [error]
    );
    return res
      .status(genericError.statusCode)
      .json(
        new ApiResponse(genericError.statusCode, null, genericError.message)
      );
  }
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // get video, upload to cloudinary, create video
  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }

  if (!req.files || !req.files.videoFile || !req.files.thumbnail) {
    throw new ApiError(400, "Video and thumbnail are required");
  }

  const videoLocalPath = req.files.videoFile[0].path;
  const thumbnailLocalPath = req.files.thumbnail[0].path;

  if (!videoLocalPath) {
    throw new ApiError(400, "Video file is required");
  }
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail file is required");
  }

  try {
    const videoResponse = await uploadOnCloudinary(videoLocalPath);
    const thumbnailResponse = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoResponse || !thumbnailResponse) {
      throw new ApiError(500, "Failed to upload video or thumbnail");
    }

    //get duration of video
    const duration = videoResponse.duration;

    //create video document
    const video = await Video.create({
      title,
      description,
      videoFile: videoResponse.url,
      thumbnail: thumbnailResponse.url,
      duration,
      owner: req.user?._id,
      isPublished: true,
    });

    if (!video) {
      throw new ApiError(500, "Failed to create video");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, video, "Video created successfully"));
  } catch (error) {
    // Delete video and thumbnail from cloudinary if error occurs after uploading

    if (videoResponse?.public_id) {
      await deleteFromCloudinary(videoResponse.public_id, "video");
    }
    if (thumbnailResponse?.public_id) {
      await deleteFromCloudinary(thumbnailResponse.public_id);
    }

    console.error("Error publishing video:", error);
    throw error; // Re-throw the error to be caught by the asyncHandler
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // get video by id
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format");
  }
  try {
    const video = await Video.findById(videoId).populate(
      "owner",
      "username fullname avatar"
    );

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video fetched successfully"));
  } catch (error) {
    console.error("Error fetching video:", error);
    throw new ApiError(500, "Failed to fetch video", error);
  }
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // update video details like title, description, thumbnail
  const { title, description } = req.body;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format");
  }

  if (!title && !description && !thumbnailLocalPath) {
    throw new ApiError(
      400,
      "At least one field (title, description, or thumbnail) is required for update"
    );
  }

  try {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to update this video");
    }

    //upload new thumbnail
    let thumbnail;
    if (thumbnailLocalPath) {
      await deleteFromCloudinary(video?.thumbnail, "image");
      const thumbnailResponse = await uploadOnCloudinary(thumbnailLocalPath);

      if (!thumbnailResponse) {
        throw new ApiError(500, "Failed to upload thumbnail");
      }

      thumbnail = thumbnailCloudinaryResponse.url;
    }

    //update video
    const updateVideo = await Video.findByIdAndUpdate(
      videoId,
      {
        $set: {
          title: title || video.title,
          description: description || video.description,
          thumbnail: thumbnail || video.thumbnail,
        },
      },
      {
        new: true,
      }
    );

    if (!updateVideo) {
      throw new ApiError(500, "Failed to update video");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, updateVideo, "Video updated successfully"));
  } catch (error) {
    console.error("Error updating video:", error);
    throw new ApiError(500, "Failed to update video", error);
  }
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // delete video
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format");
  }
  try {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to delete this video");
    }

    await Video.findByIdAndDelete(videoId);

    await deleteFromCloudinary(video?.videoFile, "video");
    await deleteFromCloudinary(video?.thumbnail, "image");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Video deleted successfully"));
  } catch (error) {
    console.error("Error deleting video:", error);
    throw new ApiError(500, "Failed to delete video", error);
  }
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // toggle publish status of video
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format");
  }
  try {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(
        403,
        "You are not authorized to toggle publish status"
      );
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isPublished: video.isPublished },
          "Publish status toggled successfully"
        )
      );
  } catch (error) {
    console.error("Error toggling publish status:", error);
    throw new ApiError(500, "Failed to toggle publish status", error);
  }
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
