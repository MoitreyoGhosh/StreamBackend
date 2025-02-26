import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Missing video ID or Invalid video ID format");
  }

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  if (isNaN(pageNumber) || pageNumber < 1) {
    throw new ApiError(400, "Invalid page number.");
  }

  if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    throw new ApiError(400, "Invalid limit. Must be between 1 and 100.");
  }

  const skip = (pageNumber - 1) * limitNumber;

  const aggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerInfo",
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
      $project: {
        content: 1,
        video: 1,
        owner: 1,
        ownerInfo: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  try {
    const options = {
      page: pageNumber,
      limit: limitNumber,
    };

    const comments = await Comment.aggregatePaginate(aggregate, options);

    if (comments.docs.length === 0) {
      throw new ApiError(404, "No comments found for this video");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          comments: comments.docs,
          totalComments: comments.totalDocs,
          page: comments.page,
          limit: comments.limit,
          totalPages: comments.totalPages,
        },
        "Successfully fetched video comments"
      )
    );
  } catch (error) {
    console.error("Error fetching video comments:", error);
    throw new ApiError(500, "Failed to fetch video comments", error);
  }
});

const addComment = asyncHandler(async (req, res) => {
  //add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format");
  }

  if (!content || content.trim() === "") {
    throw new ApiError(400, "Missing content! Comment content is required");
  }

  try {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    //add comment
    const comment = await Comment.create({
      content,
      video: videoId,
      owner: req.user?._id,
    });

    if (!comment) {
      throw new ApiError(500, "Failed to add comment");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, comment, "Successfully added comment"));
  } catch (error) {
    console.error("Error adding comment:", error);
    throw new ApiError(500, "Failed to add comment", error);
  }
});

const updateComment = asyncHandler(async (req, res) => {
  //update a comment
  const { commentId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID format");
  }

  if (!content || content.trim() === "") {
    throw new ApiError(400, "Missing content! Comment content is required");
  }

  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      throw new ApiError(404, "Comment not found");
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to update this comment");
    }

    //update comment
    const updateComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $set: { content: content },
      },
      { new: true }
    );

    if (!updateComment) {
      throw new ApiError(500, "Failed to update comment");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, updateComment, "Successfully updated comment")
      );
  } catch (error) {
    console.error("Error updating comment:", error);
    throw new ApiError(500, "Failed to update comment", error);
  }
});

const deleteComment = asyncHandler(async (req, res) => {
  //delete a comment
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID format");
  }

  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      throw new ApiError(404, "Comment not found");
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to delete this comment");
    }

    //delete comment
    const deleteComment = await Comment.findByIdAndDelete(commentId);

    if (!deleteComment) {
      throw new ApiError(500, "Failed to delete comment");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Successfully deleted comment"));
  } catch (error) {
    console.error("Error deleting comment:", error);
    throw new ApiError(500, "Failed to delete comment", error);
  }
});

export { getVideoComments, addComment, updateComment, deleteComment };
