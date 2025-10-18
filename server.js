import express from "express";
import cors from "cors";
import { setupRoutes } from "./routes/routes.js";  // Подключаем маршруты

const app = express();
app.use(cors());
app.use(express.json());

// Настроим все маршруты
setupRoutes(app);

app.listen(3000, () => console.log("🚀 API: http://localhost:3000"));
