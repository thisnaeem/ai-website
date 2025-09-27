const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

// Type definitions
interface UserSettings {
  geminiApiKey?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  [key: string]: unknown;
}

interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  picture?: string;
  followersCount?: number;
  [key: string]: unknown;
}

interface PostData {
  title: string;
  content: string;
  postType: string;
  mediaUrls: string[];
  carouselImages: string[];
  pageId: string;
  pageName: string;
  scheduledFor: string;
  intervalMinutes?: number | null;
  isRecurring: boolean;
  firstComment?: string;
  postFirstComment: boolean;
  [key: string]: unknown;
}

// Get auth token from localStorage
const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
};

// Function to refresh access token
async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    } else {
      // Refresh token is invalid, clear storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return false;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return false;
  }
}

// Generic API call function with automatic token refresh
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  // If unauthorized and we have a refresh token, try to refresh
  if (response.status === 401 && typeof window !== 'undefined') {
    const refreshSuccess = await refreshAccessToken();
    
    if (refreshSuccess) {
      // Retry the request with new token
      const newToken = getAuthToken();
      const retryConfig: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(newToken && { Authorization: `Bearer ${newToken}` }),
          ...options.headers,
        },
      };
      
      response = await fetch(`${API_BASE_URL}${endpoint}`, retryConfig);
    }
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// User Settings API
export const userSettingsAPI = {
  // Get user settings
  async getSettings() {
    const response = await apiCall('/user-settings');
    return response.data || {};
  },

  // Update user settings
  async updateSettings(settings: UserSettings) {
    return apiCall('/user-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // Update API key
  async updateApiKey(geminiApiKey: string) {
    return apiCall('/user-settings/api-key', {
      method: 'PUT',
      body: JSON.stringify({ geminiApiKey }),
    });
  },

  // Update Cloudinary config
  async updateCloudinaryConfig(config: {
    cloudinaryCloudName?: string;
    cloudinaryApiKey?: string;
    cloudinaryApiSecret?: string;
  }) {
    return apiCall('/user-settings/cloudinary', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  // Delete user settings
  async deleteSettings() {
    return apiCall('/user-settings', {
      method: 'DELETE',
    });
  },
};

// Facebook Pages API
export const facebookPagesAPI = {
  // Get user's Facebook pages
  async getUserPages() {
    const response = await apiCall('/facebook-pages/user/pages');
    return response.data || [];
  },

  // Sync user's Facebook pages
  async syncUserPages(pages: FacebookPage[]) {
    return apiCall('/facebook-pages/user/sync', {
      method: 'POST',
      body: JSON.stringify(pages),
    });
  },

  // Set selected page
  async setSelectedPage(pageId: string) {
    return apiCall(`/facebook-pages/user/selected/${pageId}`, {
      method: 'PUT',
    });
  },

  // Get selected page
  async getSelectedPage() {
    return apiCall('/facebook-pages/user/selected');
  },

  // Remove user page
  async removeUserPage(pageId: string) {
    return apiCall(`/facebook-pages/user/${pageId}`, {
      method: 'DELETE',
    });
  },
};

// Posts API
export const postsAPI = {
  // Create a scheduled post
  async createScheduledPost(postData: PostData) {
    return apiCall('/posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });
  },

  // Get all scheduled posts
  async getScheduledPosts() {
    const response = await apiCall('/posts');
    return response.data || {};
  },

  // Get a specific scheduled post
  async getScheduledPost(id: string) {
    const response = await apiCall(`/posts/${id}`);
    return response.data || {};
  },

  // Update a scheduled post
  async updateScheduledPost(id: string, updateData: Partial<PostData>) {
    return apiCall(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  // Delete scheduled post
  async deleteScheduledPost(id: string) {
    return apiCall(`/posts/${id}`, {
      method: 'DELETE',
    });
  },

  // Bulk actions
  async stopAutomation(pageId: string = 'all') {
    return apiCall('/posts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'stop_automation',
        pageId
      }),
    });
  },

  async deleteAllScheduledPosts(pageId: string = 'all') {
    return apiCall('/posts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete_all',
        pageId
      }),
    });
  },

  async deleteAllPosts(pageId: string = 'all') {
    return apiCall('/posts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete_all_posts',
        pageId
      }),
    });
  },

  async disableAllRecurring(pageId: string = 'all') {
    return apiCall('/posts/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'disable_recurring',
        pageId
      }),
    });
  },
};

// Test API endpoints
export const testAPI = {
  // Test Gemini API key
  async testGeminiKey(apiKey: string) {
    return apiCall('/user-settings/test-gemini', {
      method: 'POST',
      body: JSON.stringify({ geminiApiKey: apiKey }),
    });
  },

  // Test Cloudinary configuration
  async testCloudinary(config: {
    cloudinaryCloudName: string;
    cloudinaryApiKey: string;
    cloudinaryApiSecret: string;
  }) {
    return apiCall('/user-settings/test-cloudinary', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },
};