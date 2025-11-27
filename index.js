// import express from 'express';
// import mongoose from 'mongoose';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import userRoutes from './src/routes/user.route.js';
// import authRoutes from './src/routes/auth.route.js';
// import postRoutes from './src/routes/post.route.js';
// import commentRoutes from './src/routes/comment.route.js';
// import cookieParser from 'cookie-parser';

// // Configure environment variables
// if (process.env.NODE_ENV !== 'production') {
//   dotenv.config();
// }

// const app = express();

// // CORS configuration - UPDATE THESE DOMAINS WHEN YOU DEPLOY
// app.use(
//   cors({
//     origin:
//       process.env.NODE_ENV === 'production'
//         ? [
//             'https://blog.100jsprojects.com',
//             'https://mern-blog-client-steel.vercel.app',
//             /\.vercel\.app$/,
//           ]
//         : ['http://localhost:5173', 'http://localhost:3000'],
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
//   })
// );
// let isConnected = false;
// const connectDB = async () => {
//   if (isConnected) return;

//   try {
//     await mongoose.connect(process.env.MONGO, {
//       serverSelectionTimeoutMS: 10000,
//       socketTimeoutMS: 45000,
//       maxPoolSize: 1,
//       minPoolSize: 0,
//     });
//     isConnected = true;
//     console.log('✅ Connected to MongoDB');
//   } catch (err) {
//     console.log('❌ MongoDB connection error:', err.message);
//     isConnected = false;
//     throw err;
//   }
// };

// // Middleware
// app.use(express.json());
// app.use(cookieParser());

// // Database middleware (only for endpoints that need DB)
// const connectMiddleware = async (req, res, next) => {
//   try {
//     await connectDB();
//     next();
//   } catch (error) {
//     res
//       .status(500)
//       .json({ success: false, message: 'Database connection failed' });
//   }
// };

// // Test endpoints
// app.get('/api/test', (req, res) => {
//   res.json({ message: 'API is working!', timestamp: new Date() });
// });

// // Debug endpoints (helpful for deployment testing)
// app.get('/api/debug', (req, res) => {
//   res.json({
//     message: 'Debug info',
//     nodeEnv: process.env.NODE_ENV,
//     hasMongoEnv: !!process.env.MONGO,
//     hasJwtSecret: !!process.env.JWT_SECRET,
//     timestamp: new Date(),
//   });
// });

// app.get('/api/debug-db', async (req, res) => {
//   try {
//     await connectDB();
//     res.json({
//       message: 'Database connection successful!',
//       connected: true,
//       timestamp: new Date(),
//     });
//   } catch (error) {
//     res.json({
//       message: 'Database connection failed',
//       connected: false,
//       error: error.message,
//       timestamp: new Date(),
//     });
//   }
// });

// // Routes
// app.use('/api/user', connectMiddleware, userRoutes);
// app.use('/api/auth', connectMiddleware, authRoutes);
// app.use('/api/post', connectMiddleware, postRoutes);
// app.use('/api/comment', connectMiddleware, commentRoutes);

// // Error handling
// app.use((err, req, res, next) => {
//   const statusCode = err.statusCode || 500;
//   const message = err.message || 'Internal Server Error';
//   return res.status(statusCode).json({
//     success: false,
//     message,
//     statusCode,
//   });
// });


// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });


// // Export for Vercel
// export default app;


// ================== HIDE LOGS IN PRODUCTION ==================
if (process.env.NODE_ENV === "production") {
  const allowed = ["Server running", "Connected to Supabase"];

  const originalLog = console.log;
  console.log = function (...args) {
    const msg = args.join(" ");
    if (allowed.some(a => msg.includes(a))) {
      originalLog(...args);  // show ONLY allowed logs
    }
  };
}
// ==============================================================


import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './src/routes/user.route.js';
import authRoutes from './src/routes/auth.route.js';
import postRoutes from './src/routes/post.route.js';
import commentRoutes from './src/routes/comment.route.js';
import cookieParser from 'cookie-parser';
import { supabase } from './src/config/supabase.js';

// Configure environment variables
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            'https://blog.100jsprojects.com',
            'https://mern-blog-client-steel.vercel.app',
            /\.vercel\.app$/,
          ]
        : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  })
);

// Test Supabase connection
const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Connected to Supabase');
    return true;
  } catch (err) {
    console.log('❌ Supabase connection error:', err.message);
    return false;
  }
};

// Middleware
app.use(express.json());
app.use(cookieParser());

// Test endpoints
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date() });
});

// Debug endpoints
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Debug info',
    nodeEnv: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
    hasJwtSecret: !!process.env.JWT_SECRET,
    timestamp: new Date(),
  });
});

app.get('/api/debug-db', async (req, res) => {
  try {
    const connected = await testSupabaseConnection();
    res.json({
      message: connected ? 'Database connection successful!' : 'Database connection failed',
      connected,
      timestamp: new Date(),
    });
  } catch (error) {
    res.json({
      message: 'Database connection failed',
      connected: false,
      error: error.message,
      timestamp: new Date(),
    });
  }
});

// Routes (no connectMiddleware needed with Supabase)
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/post', postRoutes);
app.use('/api/comment', commentRoutes);

// Error handling
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(statusCode).json({
    success: false,
    message,
    statusCode,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  testSupabaseConnection();
});

// Export for Vercel
export default app;
