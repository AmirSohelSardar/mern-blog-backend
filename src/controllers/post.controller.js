import { supabase } from '../config/supabase.js';
import { errorHandler } from '../utils/error.js';

export const create = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, 'You are not allowed to create a post'));
  }
  if (!req.body.title || !req.body.content) {
    return next(errorHandler(400, 'Please provide all required fields'));
  }

  const slug = req.body.title
    .split(' ')
    .join('-')
    .toLowerCase()
    .replace(/[^a-zA-Z0-9-]/g, '');

  try {
    const { data: savedPost, error } = await supabase
      .from('posts')
      .insert([
        {
          title: req.body.title,
          content: req.body.content,
          image: req.body.image,
          category: req.body.category,
          slug,
          user_id: req.user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return next(errorHandler(400, 'Title or slug already exists'));
      }
      throw error;
    }

    res.status(201).json({
      ...savedPost,
      _id: savedPost.id,
      userId: savedPost.user_id,
      createdAt: savedPost.created_at,
      updatedAt: savedPost.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

export const getposts = async (req, res, next) => {
  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.order === 'asc' ? 'asc' : 'desc';

    let query = supabase.from('posts').select('*', { count: 'exact' });

    // Apply filters
    if (req.query.userId) {
      query = query.eq('user_id', req.query.userId);
    }
    if (req.query.category) {
      query = query.eq('category', req.query.category);
    }
    if (req.query.slug) {
      query = query.eq('slug', req.query.slug);
    }
    if (req.query.postId) {
      query = query.eq('id', req.query.postId);
    }
    if (req.query.searchTerm) {
      query = query.or(
        `title.ilike.%${req.query.searchTerm}%,content.ilike.%${req.query.searchTerm}%`
      );
    }

    const { data: posts, error, count: totalPosts } = await query
      .order('updated_at', { ascending: sortDirection === 'asc' })
      .range(startIndex, startIndex + limit - 1);

    if (error) throw error;

    const now = new Date();
    const oneMonthAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );

    const { count: lastMonthPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneMonthAgo.toISOString());

    const formattedPosts = posts.map((post) => ({
      ...post,
      _id: post.id,
      userId: post.user_id,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    }));

    res.status(200).json({
      posts: formattedPosts,
      totalPosts,
      lastMonthPosts,
    });
  } catch (error) {
    next(error);
  }
};

export const deletepost = async (req, res, next) => {
  if (!req.user.isAdmin || req.user.id !== req.params.userId) {
    return next(errorHandler(403, 'You are not allowed to delete this post'));
  }

  try {
    // Get post data first to find the image
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('image')
      .eq('id', req.params.postId)
      .single();

    if (fetchError) throw fetchError;

    // Delete image from storage if it exists
    if (post?.image) {
      try {
        // Extract the file path from the URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/posts/posts/filename.jpg
        // We need: posts/filename.jpg
        
        const url = post.image;
        
        // Split by '/object/public/posts/' to get everything after
        if (url.includes('/object/public/posts/')) {
          const pathAfterBucket = url.split('/object/public/posts/')[1];
          // pathAfterBucket will be: "posts/1764246856846_img4.jpg"
          
          console.log('Deleting file from storage:', pathAfterBucket);
          
          const { data: deleteData, error: storageError } = await supabase.storage
            .from('posts')
            .remove([pathAfterBucket]);

          if (storageError) {
            console.error('Storage deletion error:', storageError);
          } else {
            console.log('File deleted successfully:', deleteData);
          }
        }
      } catch (storageErr) {
        console.error('Error deleting image from storage:', storageErr);
      }
    }

    // Delete post from database
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', req.params.postId);

    if (error) throw error;

    res.status(200).json('The post has been deleted');
  } catch (error) {
    next(error);
  }
};

export const updatepost = async (req, res, next) => {
  if (!req.user.isAdmin || req.user.id !== req.params.userId) {
    return next(errorHandler(403, 'You are not allowed to update this post'));
  }

  try {
    const updates = {};
    if (req.body.title) updates.title = req.body.title;
    if (req.body.content) updates.content = req.body.content;
    if (req.body.category) updates.category = req.body.category;
    if (req.body.image) updates.image = req.body.image;

    const { data: updatedPost, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', req.params.postId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      ...updatedPost,
      _id: updatedPost.id,
      userId: updatedPost.user_id,
      createdAt: updatedPost.created_at,
      updatedAt: updatedPost.updated_at,
    });
  } catch (error) {
    next(error);
  }
};