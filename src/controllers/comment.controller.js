// import Comment from '../models/comment.model.js';

// export const createComment = async (req, res, next) => {
//   try {
//     const { content, postId, userId } = req.body;

//     if (userId !== req.user.id) {
//       return next(
//         errorHandler(403, 'You are not allowed to create this comment')
//       );
//     }

//     const newComment = new Comment({
//       content,
//       postId,
//       userId,
//     });
//     await newComment.save();

//     res.status(200).json(newComment);
//   } catch (error) {
//     next(error);
//   }
// };

// export const getPostComments = async (req, res, next) => {
//   try {
//     const comments = await Comment.find({ postId: req.params.postId }).sort({
//       createdAt: -1,
//     });
//     res.status(200).json(comments);
//   } catch (error) {
//     next(error);
//   }
// };

// export const likeComment = async (req, res, next) => {
//   try {
//     const comment = await Comment.findById(req.params.commentId);
//     if (!comment) {
//       return next(errorHandler(404, 'Comment not found'));
//     }
//     const userIndex = comment.likes.indexOf(req.user.id);
//     if (userIndex === -1) {
//       comment.numberOfLikes += 1;
//       comment.likes.push(req.user.id);
//     } else {
//       comment.numberOfLikes -= 1;
//       comment.likes.splice(userIndex, 1);
//     }
//     await comment.save();
//     res.status(200).json(comment);
//   } catch (error) {
//     next(error);
//   }
// };

// export const editComment = async (req, res, next) => {
//   try {
//     const comment = await Comment.findById(req.params.commentId);
//     if (!comment) {
//       return next(errorHandler(404, 'Comment not found'));
//     }
//     if (comment.userId !== req.user.id && !req.user.isAdmin) {
//       return next(
//         errorHandler(403, 'You are not allowed to edit this comment')
//       );
//     }

//     const editedComment = await Comment.findByIdAndUpdate(
//       req.params.commentId,
//       {
//         content: req.body.content,
//       },
//       { new: true }
//     );
//     res.status(200).json(editedComment);
//   } catch (error) {
//     next(error);
//   }
// };

// export const deleteComment = async (req, res, next) => {
//   try {
//     const comment = await Comment.findById(req.params.commentId);
//     if (!comment) {
//       return next(errorHandler(404, 'Comment not found'));
//     }
//     if (comment.userId !== req.user.id && !req.user.isAdmin) {
//       return next(
//         errorHandler(403, 'You are not allowed to delete this comment')
//       );
//     }
//     await Comment.findByIdAndDelete(req.params.commentId);
//     res.status(200).json('Comment has been deleted');
//   } catch (error) {
//     next(error);
//   }
// };

// export const getcomments = async (req, res, next) => {
//   if (!req.user.isAdmin)
//     return next(errorHandler(403, 'You are not allowed to get all comments'));
//   try {
//     const startIndex = parseInt(req.query.startIndex) || 0;
//     const limit = parseInt(req.query.limit) || 9;
//     const sortDirection = req.query.sort === 'desc' ? -1 : 1;
//     const comments = await Comment.find()
//       .sort({ createdAt: sortDirection })
//       .skip(startIndex)
//       .limit(limit);
//     const totalComments = await Comment.countDocuments();
//     const now = new Date();
//     const oneMonthAgo = new Date(
//       now.getFullYear(),
//       now.getMonth() - 1,
//       now.getDate()
//     );
//     const lastMonthComments = await Comment.countDocuments({
//       createdAt: { $gte: oneMonthAgo },
//     });
//     res.status(200).json({ comments, totalComments, lastMonthComments });
//   } catch (error) {
//     next(error);
//   }
// };


import { supabase } from '../config/supabase.js';
import { errorHandler } from '../utils/error.js';

export const createComment = async (req, res, next) => {
  try {
    const { content, postId, userId } = req.body;

    if (userId !== req.user.id) {
      return next(
        errorHandler(403, 'You are not allowed to create this comment')
      );
    }

    const { data: newComment, error } = await supabase
      .from('comments')
      .insert([
        {
          content,
          post_id: postId,
          user_id: userId,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      ...newComment,
      _id: newComment.id,
      postId: newComment.post_id,
      userId: newComment.user_id,
      numberOfLikes: newComment.number_of_likes,
      createdAt: newComment.created_at,
      updatedAt: newComment.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

export const getPostComments = async (req, res, next) => {
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', req.params.postId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedComments = comments.map((comment) => ({
      ...comment,
      _id: comment.id,
      postId: comment.post_id,
      userId: comment.user_id,
      numberOfLikes: comment.number_of_likes,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    }));

    res.status(200).json(formattedComments);
  } catch (error) {
    next(error);
  }
};

export const likeComment = async (req, res, next) => {
  try {
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', req.params.commentId)
      .single();

    if (fetchError || !comment) {
      return next(errorHandler(404, 'Comment not found'));
    }

    const likes = comment.likes || [];
    const userIndex = likes.indexOf(req.user.id);

    let updatedLikes;
    let updatedCount;

    if (userIndex === -1) {
      updatedLikes = [...likes, req.user.id];
      updatedCount = comment.number_of_likes + 1;
    } else {
      updatedLikes = likes.filter((id) => id !== req.user.id);
      updatedCount = comment.number_of_likes - 1;
    }

    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update({
        likes: updatedLikes,
        number_of_likes: updatedCount,
      })
      .eq('id', req.params.commentId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      ...updatedComment,
      _id: updatedComment.id,
      postId: updatedComment.post_id,
      userId: updatedComment.user_id,
      numberOfLikes: updatedComment.number_of_likes,
      createdAt: updatedComment.created_at,
      updatedAt: updatedComment.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

export const editComment = async (req, res, next) => {
  try {
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', req.params.commentId)
      .single();

    if (fetchError || !comment) {
      return next(errorHandler(404, 'Comment not found'));
    }

    if (comment.user_id !== req.user.id && !req.user.isAdmin) {
      return next(
        errorHandler(403, 'You are not allowed to edit this comment')
      );
    }

    const { data: editedComment, error: updateError } = await supabase
      .from('comments')
      .update({ content: req.body.content })
      .eq('id', req.params.commentId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      ...editedComment,
      _id: editedComment.id,
      postId: editedComment.post_id,
      userId: editedComment.user_id,
      numberOfLikes: editedComment.number_of_likes,
      createdAt: editedComment.created_at,
      updatedAt: editedComment.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', req.params.commentId)
      .single();

    if (fetchError || !comment) {
      return next(errorHandler(404, 'Comment not found'));
    }

    if (comment.user_id !== req.user.id && !req.user.isAdmin) {
      return next(
        errorHandler(403, 'You are not allowed to delete this comment')
      );
    }

    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', req.params.commentId);

    if (deleteError) throw deleteError;

    res.status(200).json('Comment has been deleted');
  } catch (error) {
    next(error);
  }
};

export const getcomments = async (req, res, next) => {
  if (!req.user.isAdmin)
    return next(errorHandler(403, 'You are not allowed to get all comments'));

  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.sort === 'desc' ? 'desc' : 'asc';

    const { data: comments, error, count: totalComments } = await supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: sortDirection === 'asc' })
      .range(startIndex, startIndex + limit - 1);

    if (error) throw error;

    const now = new Date();
    const oneMonthAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );

    const { count: lastMonthComments } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneMonthAgo.toISOString());

    const formattedComments = comments.map((comment) => ({
      ...comment,
      _id: comment.id,
      postId: comment.post_id,
      userId: comment.user_id,
      numberOfLikes: comment.number_of_likes,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    }));

    res.status(200).json({
      comments: formattedComments,
      totalComments,
      lastMonthComments,
    });
  } catch (error) {
    next(error);
  }
};