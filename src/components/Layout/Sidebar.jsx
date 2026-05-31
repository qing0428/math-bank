const menuItems = [
  { key: 'dashboard', label: '数据概览', icon: '📊' },
  { key: 'entry', label: '录入题目', icon: '✏️' },
  { key: 'search', label: '题库', icon: '📚' },
  { key: 'paper', label: '组卷', icon: '📝' },
  { key: 'settings', label: 'API 设置', icon: '⚙️' },
]

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggle }) {
  return (
    <aside
      className={`bg-gradient-to-b from-primary-500 to-primary-700 text-white flex flex-col shadow-lg flex-shrink-0 transition-all duration-200
        ${collapsed ? 'w-16' : 'w-52'}`}
    >
      {/* Logo */}
      <div className={`px-4 py-5 border-b border-white/20 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div>
            <h1 className="font-heading text-base font-bold tracking-wide">📐 数学题库</h1>
            <p className="text-primary-200 text-xs mt-0.5">Math Question Bank</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="text-white/70 hover:text-white transition-colors text-lg cursor-pointer p-1"
          title={collapsed ? '展开菜单' : '收起菜单'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-3">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            title={collapsed ? item.label : undefined}
            className={`w-full text-left flex items-center transition-all duration-200 cursor-pointer
              ${collapsed
                ? 'px-0 py-3 justify-center'
                : 'px-5 py-3 gap-3'}
              ${currentPage === item.key
                ? `${collapsed ? '' : 'pr-4'} bg-white/20 border-r-4 border-white font-semibold shadow-inner`
                : `hover:bg-white/10 border-r-4 border-transparent`
              }`}
          >
            <span className={`text-lg flex-shrink-0 ${collapsed ? '' : ''}`}>{item.icon}</span>
            {!collapsed && <span className="text-sm">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-5 py-3 border-t border-white/20 text-xs text-primary-200">
          <p>UI/UX Pro Max Powered</p>
          <p className="text-primary-300 mt-0.5">v1.0.7</p>
        </div>
      )}
    </aside>
  )
}
