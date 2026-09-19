/**
 * Meta Graph API Integration
 * Handle real API calls to Facebook and Instagram
 */

const axios = require('axios');

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Helper to make Meta API calls
async function metaApiCall(endpoint, accessToken, params = {}) {
  try {
    const url = `${GRAPH_API_BASE}${endpoint}`;
    const response = await axios.get(url, {
      params: {
        ...params,
        access_token: accessToken
      },
      timeout: 15000
    });
    return response.data;
  } catch (error) {
    const errorData = error.response?.data?.error || {};
    const errorCode = errorData.code;
    const errorMsg = errorData.message;

    // Handle specific Meta API errors
    if (errorCode === 190) {
      throw new Error('Access Token expired or invalid. Please refresh your token.');
    } else if (errorCode === 200) {
      throw new Error('Permission denied. Check your Access Token permissions.');
    } else if (errorCode === 100) {
      throw new Error('Invalid parameter. Check Post ID or Media ID format.');
    } else if (errorCode === 803) {
      throw new Error('Cannot query this post. It may be deleted or not accessible.');
    } else if (errorMsg) {
      throw new Error(errorMsg);
    }
    throw error;
  }
}

// Fetch Facebook pages
async function getFacebookPages(accessToken) {
  try {
    const data = await metaApiCall('/me', accessToken, {
      fields: 'accounts'
    });

    if (!data.accounts || !data.accounts.data) {
      return [];
    }

    return data.accounts.data.map(page => ({
      id: page.id,
      name: page.name,
      access_token: page.access_token
    }));
  } catch (error) {
    console.error('Error fetching Facebook pages:', error.message);
    throw error;
  }
}

// Get Instagram Business Account linked to Facebook Page
async function getInstagramAccount(pageId, accessToken) {
  try {
    const data = await metaApiCall(`/${pageId}`, accessToken, {
      fields: 'instagram_business_accounts'
    });

    if (!data.instagram_business_accounts || !data.instagram_business_accounts.data.length) {
      throw new Error('No Instagram Professional account found linked to this page. Make sure your Instagram account is Professional/Business.');
    }

    const igAccount = data.instagram_business_accounts.data[0];
    return {
      id: igAccount.id,
      name: igAccount.name
    };
  } catch (error) {
    console.error('Error fetching Instagram account:', error.message);
    throw error;
  }
}

// Fetch comments from Facebook Post
async function fetchFacebookComments(postId, accessToken) {
  try {
    console.log(`🔄 Fetching Facebook comments for post: ${postId}`);

    const comments = [];
    let hasMore = true;
    let after = null;
    let totalFetched = 0;

    while (hasMore) {
      const params = {
        fields: 'id,message,from,created_time,like_count,comments.limit(0).summary(true)',
        limit: 100,
        summary: true
      };

      if (after) {
        params.after = after;
      }

      const data = await metaApiCall(`/${postId}/comments`, accessToken, params);

      if (!data.data || data.data.length === 0) {
        hasMore = false;
        break;
      }

      // Process comments
      data.data.forEach(comment => {
        if (comment.message) {
          const mentions = (comment.message.match(/@\w+/g) || []).length;
          comments.push({
            comment_id: comment.id,
            user_id: comment.from.id,
            username: comment.from.name, // Facebook doesn't provide username directly
            name: comment.from.name,
            text: comment.message,
            likes_count: comment.like_count || 0,
            created_time: comment.created_time,
            mentions_count: mentions,
            is_reply: 0, // Top-level comment
            parent_comment_id: null,
            is_eligible: 1,
            platform: 'facebook'
          });
          totalFetched++;
        }
      });

      // Check if there are more pages
      if (data.paging && data.paging.cursors && data.paging.cursors.after) {
        after = data.paging.cursors.after;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Fetched ${totalFetched} Facebook comments`);
    return comments;
  } catch (error) {
    console.error('Error fetching Facebook comments:', error.message);
    throw error;
  }
}

// Fetch comments from Instagram Media
async function fetchInstagramComments(mediaId, accessToken) {
  try {
    console.log(`🔄 Fetching Instagram comments for media: ${mediaId}`);

    const comments = [];
    let hasMore = true;
    let after = null;
    let totalFetched = 0;

    while (hasMore) {
      const params = {
        fields: 'id,text,from,timestamp,like_count,replies.limit(0).summary(true)',
        limit: 100,
        summary: true
      };

      if (after) {
        params.after = after;
      }

      const data = await metaApiCall(`/${mediaId}/comments`, accessToken, params);

      if (!data.data || data.data.length === 0) {
        hasMore = false;
        break;
      }

      // Process comments
      data.data.forEach(comment => {
        if (comment.text) {
          const mentions = (comment.text.match(/@\w+/g) || []).length;
          comments.push({
            comment_id: comment.id,
            user_id: comment.from.id,
            username: comment.from.username || comment.from.name,
            name: comment.from.name,
            text: comment.text,
            likes_count: comment.like_count || 0,
            created_time: comment.timestamp,
            mentions_count: mentions,
            is_reply: 0, // Top-level comment
            parent_comment_id: null,
            is_eligible: 1,
            platform: 'instagram'
          });
          totalFetched++;
        }
      });

      // Check if there are more pages
      if (data.paging && data.paging.cursors && data.paging.cursors.after) {
        after = data.paging.cursors.after;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Fetched ${totalFetched} Instagram comments`);
    return comments;
  } catch (error) {
    console.error('Error fetching Instagram comments:', error.message);
    throw error;
  }
}

// Validate Access Token
async function validateAccessToken(accessToken) {
  try {
    const data = await metaApiCall('/me', accessToken, {
      fields: 'id,name,email'
    });
    return {
      valid: true,
      userId: data.id,
      name: data.name,
      email: data.email
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  getFacebookPages,
  getInstagramAccount,
  fetchFacebookComments,
  fetchInstagramComments,
  validateAccessToken,
  metaApiCall
};
