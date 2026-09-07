const slides = [...document.querySelectorAll('.slide')];
let current = 0;
function move(index) { slides[Math.max(0, Math.min(slides.length - 1, index))].scrollIntoView(); }
document.querySelector('#previous').addEventListener('click', () => move(current - 1));
document.querySelector('#next').addEventListener('click', () => move(current + 1));
document.addEventListener('keydown', event => {
    if (event.target.closest('button,a,input,textarea,select')) return;
    if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault(); move(current + (['ArrowRight', 'PageDown'].includes(event.key) ? 1 : -1));
    }
});
// Observe every slide so scrolling and buttons share the same position.
const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting);
    if (!visible.length) return;
    current = slides.indexOf(visible[visible.length - 1].target);
    document.querySelector('#position').textContent = `${current + 1} / ${slides.length}`;
    document.querySelector('#previous').disabled = current === 0;
    document.querySelector('#next').disabled = current === slides.length - 1;
}, { rootMargin: '-20% 0px -40% 0px' });
slides.forEach(slide => observer.observe(slide));
