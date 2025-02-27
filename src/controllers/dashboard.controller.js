import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/likes.model.js";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  //Get the channel stats like total video views, total subscribers, total videos, total likes etc.
  try {
    const { channelId } = req.params;

    if (!channelId || !isValidObjectId(channelId)) {
      throw new ApiError(400, "Missing or invalid channel ID");
    }

    const channelObjectId = new mongoose.Types.ObjectId(channelId);

    // Execute all independent queries in parallel
    const [totalVideos, totalSubscribers, totalViewsResult, totalLikesResult] =
      await Promise.all([
        Video.countDocuments({ owner: channelObjectId }),
        Subscription.countDocuments({ channel: channelObjectId }),

        // Aggregate total views across all videos
        Video.aggregate([
          { $match: { owner: channelObjectId } },
          { $group: { _id: null, totalViews: { $sum: "$views" } } },
        ]),

        // Aggregate total likes across all videos
        Video.aggregate([
          { $match: { owner: channelObjectId } },
          {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "video",
              as: "videoLikes",
            },
          },
          {
            $group: {
              _id: null,
              totalLikes: { $sum: { $size: "$videoLikes" } },
            },
          },
        ]),
      ]);

    // Extract aggregation results safely
    const totalViews =
      totalViewsResult.length > 0 ? totalViewsResult[0].totalViews : 0;
    const totalLikes =
      totalLikesResult.length > 0 ? totalLikesResult[0].totalLikes : 0;

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { totalVideos, totalSubscribers, totalViews, totalLikes },
          "Channel stats fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error getting channel stats:", error);
    throw new ApiError(500, "Failed to get channel stats", error);
  }
});

const getChannelVideos = asyncHandler(async (req, res) => {
  //Get all the videos uploaded by the channel
  try {
    const { channelId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!channelId || !isValidObjectId(channelId)) {
      throw new ApiError(400, "Missing or Invalid channel ID format");
    }

    const channelObjectId = new mongoose.Types.ObjectId(channelId);

    const videos = (await Video.find({ owner: channelObjectId }))
      .select("title description thumbnail duration views createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    if (!videos.length) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No videos found for this channel"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, videos, "Videos fetched successfully"));
  } catch (error) {
    console.error("Error getting channel videos:", error);
    throw new ApiError(500, "Failed to get channel videos", error);
  }
});

const getChannelTweetStats = asyncHandler(async (req, res) => {
  //Get the channel tweet stats like total tweet views, total subscribers, total tweets etc.
  try {
    const { channelId } = req.params;

    if (!channelId || !isValidObjectId(channelId)) {
      throw new ApiError(400, "Missing or invalid channel ID");
    }

    const channelObjectId = new mongoose.Types.ObjectId(channelId);

    let totalTweetLikes = 0;

    // Execute all independent queries in parallel
    const [totalTweets, likeAggregation, totalRetweets] = await Promise.all([
      Tweet.countDocuments({ owner: channelObjectId }),

      // Aggregate total tweet likes across all tweets
      Like.aggregate([
        {
          $lookup: {
            from: "tweets",
            localField: "tweet",
            foreignField: "_id",
            as: "tweetInfo",
          },
        },
        {
          $unwind: {
            path: "$tweetInfo",
            preserveNullAndEmptyArrays: false, //ensures counting likes that are associated with existing, valid tweets owned by the specified channel.
          },
        },
        {
          $match: {
            "tweetInfo.owner": channelObjectId,
          },
        },
        {
          $count: "totalTweetLikes",
        },
      ]),

      Tweet.countDocuments({
        owner: channelObjectId,
        isRetweet: true,
      }),
    ]);

    if (likeAggregation.length > 0) {
      totalTweetLikes = likeAggregation[0].totalTweetLikes;
    }
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalTweets,
          totalTweetLikes,
          totalRetweets,
        },
        "Channel tweet stats fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error getting channel tweet stats:", error);
    throw new ApiError(500, "Failed to get channel tweet stats", error);
  }
});

const getChannelTweets = asyncHandler(async (req, res) => {
  //Get all the tweets uploaded by the channel
  const { channelId } = req.params;
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  if (!channelId || !isValidObjectId(channelId)) {
    throw new ApiError(400, "Missing or invalid channel ID");
  }

  const channelObjectId = new mongoose.Types.ObjectId(channelId);

  try {
    const tweets = await Tweet.find({ owner: channelObjectId })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("owner", "username avatar");

    if (!tweets.length) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No videos found for this channel"));
    }

    res
      .status(200)
      .json(
        new ApiResponse(200, tweets, "Channel tweets fetched successfully")
      );
  } catch (error) {
    console.error("Error getting channel tweets:", error);
    throw new ApiError(500, "Failed to get channel tweets", error);
  }
});

export {
  getChannelStats,
  getChannelVideos,
  getChannelTweetStats,
  getChannelTweets,
};
