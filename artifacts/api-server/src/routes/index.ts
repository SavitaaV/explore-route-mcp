import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scenicRouter from "./scenic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scenicRouter);

export default router;
