import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import familyRouter from "./family";
import storiesRouter from "./stories";

const router: IRouter = Router();

router.use(storiesRouter);
router.use(familyRouter);
router.use("/admin", adminRouter);

export default router;
