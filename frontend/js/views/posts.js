window.PostsView = {
  async render() {
    const { posts } = await API.get('/posts?limit=30');
    return `<div class="flex justify-between items-center mb-4">
      <h1 style="font-size:22px;font-weight:700">📝 Blog</h1>
      ${State.isAuthed() ? `<button class="btn btn-primary btn-sm" id="new-post">+ New Post</button>` : ''}
    </div>
    ${posts.length === 0 ? '<div class="empty">No posts yet.</div>' : `<div class="grid cols-2">
      ${posts.map((p) => `<div class="post-card" data-slug="${U.esc(p.slug)}">
        <h3>${U.esc(p.title)}</h3>
        <p>${U.esc(p.excerpt || (p.content || '').replace(/<[^>]+>/g,'').slice(0,120))}</p>
        <div class="flex justify-between items-center mt-3 text-sm muted">
          <span>${U.esc(p.author?.name || 'Anonymous')}</span>
          <span>❤ ${p._count?.likes ?? 0} · 💬 ${p._count?.comments ?? 0}</span>
        </div>
      </div>`).join('')}
    </div>`}`;
  },
  async mount() {
    document.querySelectorAll('.post-card').forEach((c) => c.onclick = () => App.navigate('post', { slug: c.dataset.slug }));
    document.getElementById('new-post')?.addEventListener('click', () => this.openEditor());
  },
  async renderDetail(slug) {
    const { post } = await API.get(`/posts/${slug}`);
    return `<a href="#/posts" class="btn btn-ghost btn-sm mb-4">← Back to blog</a>
    <article class="card">
      <h1 style="font-size:26px;margin-bottom:8px">${U.esc(post.title)}</h1>
      <div class="text-sm muted mb-4">By ${U.esc(post.author?.name)} · ${U.date(post.publishedAt || post.createdAt)} · ${post.views} views</div>
      <div style="line-height:1.7">${post.content}</div>
      <div class="mt-6 flex gap-2">
        <button class="btn btn-secondary btn-sm" id="like-btn">❤ Like (${post._count?.likes ?? 0})</button>
      </div>
    </article>
    <div class="card mt-4">
      <div class="card-title">Comments (${post.comments?.length || 0})</div>
      ${State.isAuthed() ? `<form id="comment-form" class="mb-4">
        <textarea name="body" placeholder="Write a comment…" required></textarea>
        <button class="btn btn-primary btn-sm mt-2" type="submit">Post Comment</button>
      </form>` : '<p class="muted text-sm mb-4">Sign in to comment.</p>'}
      <div>
        ${(post.comments || []).map((c) => `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
          <div class="text-sm"><strong>${U.esc(c.author?.name)}</strong> · <span class="muted">${U.date(c.createdAt)}</span></div>
          <div class="mt-2">${U.esc(c.body)}</div>
          ${(c.replies || []).map((r) => `<div style="margin-left:24px;margin-top:8px;padding:8px 12px;background:var(--bg);border-radius:8px">
            <div class="text-sm"><strong>${U.esc(r.author?.name)}</strong> · <span class="muted">${U.date(r.createdAt)}</span></div>
            <div class="mt-1">${U.esc(r.body)}</div>
          </div>`).join('')}
        </div>`).join('') || '<div class="empty">No comments yet.</div>'}
      </div>
    </div>`;
  },
  async mountDetail(slug) {
    document.getElementById('like-btn')?.addEventListener('click', async () => {
      if (!State.isAuthed()) return U.toast('Sign in first', 'error');
      try {
        const { post } = await API.get(`/posts/${slug}`);
        const r = await API.post(`/posts/${post.id}/like`);
        U.toast(r.liked ? 'Liked ❤' : 'Unliked', 'success');
        App.navigate('post', { slug });
      } catch (e) { U.toast(e.message, 'error'); }
    });
    document.getElementById('comment-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = new FormData(e.target).get('body');
      try {
        const { post } = await API.get(`/posts/${slug}`);
        await API.post(`/posts/${post.id}/comments`, { body });
        U.toast('Comment added', 'success');
        App.navigate('post', { slug });
      } catch (err) { U.toast(err.message, 'error'); }
    });
  },
  openEditor() {
    U.modal({
      title: 'New Post',
      body: `<form id="post-form">
        <div class="form-row"><label>Title</label><input type="text" name="title" required></div>
        <div class="form-row"><label>Category</label><input type="text" name="category" placeholder="General"></div>
        <div class="form-row"><label>Excerpt</label><textarea name="excerpt" rows="2"></textarea></div>
        <div class="form-row"><label>Content (HTML supported)</label><textarea name="content" rows="8" required></textarea></div>
        <div class="form-row"><label><input type="checkbox" name="publish" checked> Publish now</label></div>
      </form>`,
      confirmText: 'Create Post',
      onConfirm: async (wrap) => {
        const fd = new FormData(wrap.querySelector('#post-form'));
        try {
          await API.post('/posts', {
            title: fd.get('title'), category: fd.get('category') || 'General',
            excerpt: fd.get('excerpt'), content: fd.get('content'),
            status: fd.get('publish') ? 'PUBLISHED' : 'DRAFT'
          });
          U.toast('Post created', 'success');
          App.navigate('posts');
        } catch (err) { U.toast(err.message, 'error'); }
      }
    });
  }
};
