import express from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase.js';
import {
  deleteUser,
  getUser,
  getUsers,
  signout,
  test,
  updateUser,
} from '../controllers/user.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

// Configure multer for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Profile picture upload endpoint
router.post('/upload/profile-picture', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    console.log('Uploading profile picture for user:', req.user.id);

    // Create unique filename
    const fileExt = req.file.mimetype.split('/')[1];
    const fileName = `${req.user.id}-${Date.now()}.${fileExt}`;

    // Delete old profile picture if exists
    try {
      const { data: files } = await supabase.storage
        .from('posts')
        .list('profile-pictures', {
          search: req.user.id
        });

      if (files && files.length > 0) {
        const filesToDelete = files.map(file => `profile-pictures/${file.name}`);
        await supabase.storage
          .from('posts')
          .remove(filesToDelete);
        console.log('Old profile pictures deleted');
      }
    } catch (deleteError) {
      console.log('No old files to delete or error:', deleteError.message);
    }

    // Upload new profile picture to Supabase Storage
    const { data, error } = await supabase.storage
      .from('posts')
      .upload(`profile-pictures/${fileName}`, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ 
        message: 'Failed to upload image: ' + error.message,
        error: error 
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('posts')
      .getPublicUrl(`profile-pictures/${fileName}`);

    if (!urlData || !urlData.publicUrl) {
      return res.status(500).json({ message: 'Failed to get public URL' });
    }

    console.log('Upload successful:', urlData.publicUrl);
    
    // Update user's profile picture in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        profile_picture: urlData.publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) {
      console.error('Failed to update user profile:', updateError);
      return res.status(500).json({ 
        message: 'Image uploaded but failed to update profile',
        error: updateError 
      });
    }

    res.status(200).json({ 
      url: urlData.publicUrl,
      message: 'Profile picture updated successfully'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      message: error.message || 'Internal server error',
      error: error 
    });
  }
});

// Other routes
router.get('/test', test);
router.put('/update/:userId', verifyToken, updateUser);
router.delete('/delete/:userId', verifyToken, deleteUser);
router.post('/signout', signout);
router.get('/getusers', verifyToken, getUsers);
router.get('/:userId', getUser);

export default router;