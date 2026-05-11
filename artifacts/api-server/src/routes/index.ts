import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scenicRouter from "./scenic";
import anthropicRouter from "./anthropic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scenicRouter);
router.use(anthropicRouter);

export default router;
