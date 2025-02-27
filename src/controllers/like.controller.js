import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //toggle like on video
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format");
  }

  try {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "Video not found");
    }
    //Checks if the user has already liked the video
    const existingLike = await Like.findOne({
      video: videoId,
      likedBy: req.user?._id,
    });

    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      return res
        .status(200)
        .json(
          new ApiResponse(200, { liked: false }, "Video unliked successfully")
        );
    } else {
      const like = await Like.create({
        video: videoId,
        likedBy: req.user?._id,
      });

      if (!like) {
        throw new ApiError(500, "Failed to like video");
      }

      return res
        .status(200)
        .json(
          new ApiResponse(200, { liked: true }, "Video liked successfully")
        );
    }
  } catch (error) {
    console.error("Error toggling video like:", error);
    throw new ApiError(500, "Failed to toggle video like", error);
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  //toggle like on comment
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID format");
  }

  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      throw new ApiError(404, "Comment not found");
    }

    //Checks if the user has already liked the comment
    const existingLike = await Like.findOne({
      comment: commentId,
      likedBy: req.user?._id,
    });

    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      return res
        .status(200)
        .json(
          new ApiResponse(200, { liked: false }, "Comment unliked successfully")
        );
    } else {
      const like = await Like.create({
        comment: commentId,
        likedBy: req.user?._id,
      });

      if (!like) {
        throw new ApiError(500, "Failed to like comment");
      }

      return res
        .status(200)
        .json(
          new ApiResponse(200, { liked: true }, "Comment liked successfully")
        );
    }
  } catch (error) {
    console.error("Error toggling comment like:", error);
    throw new ApiError(500, "Failed to toggle comment like", error);
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  //toggle like on tweet
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID format");
  }

  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      throw new ApiError(404, "Tweet not found");
    }
    //Checks if the user has already liked the comment
    const existingLike = await Like.findOne({
      tweet: tweetId,
      likedBy: req.user?._id,
    });

    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      return res
        .status(200)
        .json(
          new ApiResponse(200, { liked: false }, "Tweet unliked successfully")
        );
    } else {
      const like = await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id,
      });

      if (!like) {
        throw new ApiError(500, "Failed to like comment");
      }

      return res
        .status(200)
        .json(
          new ApiResponse(200, { liked: true }, "Tweet liked successfully")
        );
    }
  } catch (error) {
    console.error("Error toggling tweet like:", error);
    throw new ApiError(500, "Failed to toggle tweet like", error);
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  //get all liked videos
  try {
    const likedVideos = await Like.aggregate([
      {
        $match: {
          likedBy: new mongoose.Types.ObjectId(req.user?._id),
          video: { $exists: true },
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "video",
          foreignField: "_id",
          as: "videoDetails",
          pipeline: [
            {
              $project: {
                title: 1,
                description: 1,
                thumbnail: 1,
                owner: 1,
                duration: 1,
                views: 1,
                likes: 1,
                videoFile: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$videoDetails", // Unwind the videoDetails array
        preserveNullAndEmptyArrays: true,
      },
      {
        $lookup: {
          from: "users",
          localField: "videoDetails.owner",
          foreignField: "_id",
          as: "videoDetails.ownerInfo",
          pipeline: [
            {
              $project: {
                username: 1,
                fullname: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$videoDetails.ownerInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          "videoDetails.owner": "$videoDetails.ownerInfo",
        },
      },
      {
        $project: {
          _id: 0, // Exclude the like _id
          videoDetails: 1, // Include all video details
        },
      },
    ]);

    if (!likedVideos || likedVideos.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, { videos: [] }, "No liked videos found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { likedVideos }, "Liked videos fetched"));
  } catch (error) {
    console.error("Error getting liked videos:", error);
    throw new ApiError(500, "Failed to get liked videos", error);
  }
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
