'use client';

import { useState, useEffect } from 'react';
import { facebookPagesAPI, postsAPI } from '@/lib/api';

interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  picture?: string;
  followersCount?: number;
}

interface ScheduledPost {
  id: string;
  title: string;
  content?: string;
  postType: string;
  mediaUrls: string[];
  carouselImages: string[];
  pageId: string;
  pageName: string;
  status: string;
  scheduledFor: string;
  intervalMinutes?: number;
  isRecurring: boolean;
  firstComment?: string;
  postFirstComment: boolean;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
  facebookPostId?: string;
  errorMessage?: string;
}

export default function ScheduledPosts() {
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Filter state for scheduled posts
  const [filterPageId, setFilterPageId] = useState<string>('all');
  
  // Edit state for scheduled posts
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editIntervalMinutes, setEditIntervalMinutes] = useState<number>(10);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Load Facebook pages
  const loadFacebookPages = async () => {
    try {
      const pages = await facebookPagesAPI.getUserPages();
      setFacebookPages(pages);
    } catch (error) {
      console.error('Error loading Facebook pages:', error);
      showToast('Failed to load Facebook pages', 'error');
    }
  };

  // Load scheduled posts
  const loadScheduledPosts = async () => {
    try {
      const result = await postsAPI.getScheduledPosts();
      // Extract posts array from the response data structure
      const posts = result.posts || [];
      setScheduledPosts(posts);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
      // Set empty array on error to prevent filter issues
      setScheduledPosts([]);
    }
  };

  // Delete a scheduled post
  const deleteScheduledPost = async (postId: string) => {
    try {
      await postsAPI.deleteScheduledPost(postId);
      showToast('Post deleted successfully!', 'success');
      loadScheduledPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast('Failed to delete post', 'error');
    }
  };

  // Update a scheduled post's interval
  const updateScheduledPost = async (postId: string, newIntervalMinutes: number) => {
    try {
      await postsAPI.updateScheduledPost(postId, {
        intervalMinutes: newIntervalMinutes
      });
      showToast('Post interval updated successfully!', 'success');
      setEditingPostId(null);
      loadScheduledPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      showToast('Failed to update post', 'error');
    }
  };

  // Start editing a post
  const startEditingPost = (postId: string, currentInterval: number) => {
    setEditingPostId(postId);
    setEditIntervalMinutes(currentInterval || 10);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingPostId(null);
    setEditIntervalMinutes(10);
  };

  // Stop automation for all or specific page
  const stopAutomation = async (pageId: string = 'all') => {
    try {
      const result = await postsAPI.stopAutomation(pageId);
      showToast(result.message, 'success');
      loadScheduledPosts();
    } catch (error) {
      console.error('Error stopping automation:', error);
      showToast('Failed to stop automation', 'error');
    }
  };

  // Delete all scheduled posts for all or specific page
  const deleteAllScheduledPosts = async (pageId: string = 'all') => {
    if (!confirm(`Are you sure you want to delete all scheduled posts${pageId !== 'all' ? ' for this page' : ''}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const result = await postsAPI.deleteAllScheduledPosts(pageId);
      showToast(result.message, 'success');
      loadScheduledPosts();
    } catch (error) {
      console.error('Error deleting posts:', error);
      showToast('Failed to delete posts', 'error');
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadFacebookPages();
    loadScheduledPosts();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Scheduled Posts</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage and monitor your scheduled Facebook posts
        </p>
      </div>

      {facebookPages.length === 0 && (
        <div className="card">
          <div className="px-6 py-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Facebook Pages Configured</h3>
            <p className="text-gray-600 mb-4">
              Please add your Facebook pages in the Settings page first.
            </p>
            <a
              href="/settings"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--primary-highlight)] hover:bg-[var(--primary-highlight)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-highlight)]"
            >
              Go to Settings
            </a>
          </div>
        </div>
      )}

      {facebookPages.length > 0 && (
        <div className="card">
          <div className="px-6 py-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Scheduled Posts</h3>
              
              {/* Page Filter */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Filter by Page:</label>
                <select
                  value={filterPageId}
                  onChange={(e) => setFilterPageId(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Pages</option>
                  {facebookPages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Bulk Actions */}
            <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <h4 className="text-sm font-medium text-gray-700">Bulk Actions:</h4>
                <button
                  onClick={() => stopAutomation(filterPageId)}
                  className="px-3 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-sm font-medium transition-colors"
                >
                  {filterPageId === 'all' ? 'Stop All Automation' : 'Stop Page Automation'}
                </button>
                <button
                  onClick={() => deleteAllScheduledPosts(filterPageId)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm font-medium transition-colors"
                >
                  {filterPageId === 'all' ? 'Delete All Posts' : 'Delete Page Posts'}
                </button>
              </div>
              <div className="text-xs text-gray-500">
                {filterPageId === 'all' ? 'Actions apply to all pages' : `Actions apply to selected page only`}
              </div>
            </div>
            
            {/* Table */}
            <div>
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Page
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled For
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Published At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interval (min)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const filteredPosts = filterPageId === 'all' 
                       ? scheduledPosts 
                       : scheduledPosts.filter(post => post.pageId === filterPageId);
                    
                    return filteredPosts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                          {filterPageId === 'all' ? 'No scheduled posts yet' : 'No posts found for selected page'}
                        </td>
                      </tr>
                    ) : (
                      filteredPosts.map(post => {
                      const page = facebookPages.find(p => p.id === post.pageId);
                      return (
                      <tr key={post.id}>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">
                          {post.postType || post.title}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          <div className="flex items-center space-x-3">
                            {page?.picture ? (
                              <img
                                src={page.picture}
                                alt={page.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-600">
                                  {(post.pageName || 'U').charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span>{post.pageName || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            post.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                            post.status === 'posted' ? 'bg-green-100 text-green-800' :
                            post.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {post.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {new Date(post.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {new Date(post.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {post.postedAt ? new Date(post.postedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {editingPostId === post.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={editIntervalMinutes}
                                onChange={(e) => setEditIntervalMinutes(Number(e.target.value))}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="1"
                              />
                              <button
                                onClick={() => updateScheduledPost(post.id, editIntervalMinutes)}
                                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span>{post.intervalMinutes || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium">
                          <div className="flex space-x-2">
                            {post.status === 'posted' && post.facebookPostId ? (
                              <button
                                onClick={() => {
                                  const page = facebookPages.find(p => p.id === post.pageId);
                                  if (page && post.facebookPostId) {
                                    window.open(`https://www.facebook.com/${post.facebookPostId}`, '_blank');
                                  }
                                }}
                                className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-xs font-medium"
                              >
                                View Post
                              </button>
                            ) : (
                              <button
                                onClick={() => startEditingPost(post.id, post.intervalMinutes || 10)}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-xs font-medium"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => deleteScheduledPost(post.id)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                     })
                   );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full transform transition-all duration-300 ease-in-out ${
          toast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}>
          <div className={`rounded-lg shadow-lg border-l-4 p-4 ${
            toast.type === 'success' 
              ? 'bg-white border-green-500' 
              : 'bg-white border-red-500'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {toast.type === 'success' ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className={`text-sm font-medium ${
                  toast.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {toast.type === 'success' ? 'Success!' : 'Error!'}
                </p>
                <p className={`text-sm mt-1 ${
                  toast.type === 'success' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {toast.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => setToast(null)}
                  className={`inline-flex text-sm ${
                    toast.type === 'success' ? 'text-green-500 hover:text-green-600' : 'text-red-500 hover:text-red-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}