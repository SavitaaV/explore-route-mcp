import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scenicRouter from "./scenic";
import anthropicRouter from "./anthropic";
import shopifyCatalogRouter from "./shopify-catalog";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scenicRouter);
router.use(anthropicRouter);
router.use(shopifyCatalogRouter);

export default router;
