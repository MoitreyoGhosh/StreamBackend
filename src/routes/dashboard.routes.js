import { Router } from "express";
import {
  getChannelStats,
  getChannelVideos,
  getChannelTweetStats,
  getChannelTweets,
} from "../controllers/dashboard.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); //Apply verifyJWT middleware to all routes in this file

router.route("/channel-stats").get(getChannelStats);
router.route("/videos").get(getChannelVideos);
router.route("/tweets-stats").get(getChannelTweetStats);
router.route("/tweets").get(getChannelTweets);

export default router;
