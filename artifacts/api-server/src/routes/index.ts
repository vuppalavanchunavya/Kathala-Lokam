import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kathalaRouter from "./kathala";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kathalaRouter);

export default router;
