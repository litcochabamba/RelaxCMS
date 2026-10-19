import { useState } from 'react';
import { motion } from 'framer-motion';
import { useIntersectionObserver } from '../../hooks/useUtils';
import { useHotels, useComments, useHotelConfig, useSubmitComment } from '../../hooks/useQueries';
import toast from 'react-hot-toast';

const fallbackComments = [
  { id: '1', name: 'María García', content: 'Una experiencia increíble. El personal es muy amable y las instalaciones son de primera. Definitivamente volveré.', created_at: '2025-12-15' },
  { id: '2', name: 'Carlos Mendoza', content: 'Las habitaciones son hermosas y el desayuno es espectacular. El hotel tiene una ubicación perfecta para explorar Cochabamba.', created_at: '2025-11-28' },
  { id: '3', name: 'Ana López', content: 'Excelente relación calidad-precio. La piscina es maravillosa y el spa es muy relajante. Recomendado para parejas.', created_at: '2025-11-10' },
  { id: '4', name: 'Roberto Fernández', content: 'Nos hospedamos con toda la familia y fue perfecto. Las habitaciones familiares son amplias y cómodas. Los niños la pasaron genial.', created_at: '2025-10-22' },
  { id: '5', name: 'Laura Sánchez', content: 'El servicio es excepcional. Desde la recepción hasta el restaurante, todos son muy atentos. El spa es un paraíso.', created_at: '2025-10-05' },
];

function getConfigValue(configs: any[], key: string, fallback: string): string {
  const item = configs.find(c => c.key === key);
  return item?.value || fallback;
}

export default function CommentsSection() {
  const { ref, isVisible } = useIntersectionObserver();
  const { data: hotels } = useHotels();
  const hotelId = hotels?.[0]?.id || '';
  const { data: dbComments = [], isLoading } = useComments(hotelId);
  const { data: configs = [] } = useHotelConfig(hotelId);
  const submitComment = useSubmitComment();
  const [form, setForm] = useState({ name: '', email: '', content: '' });
  const [submitted, setSubmitted] = useState(false);

  const comments = dbComments.length > 0 ? dbComments : fallbackComments;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId) return;
    try {
      await submitComment.mutateAsync({ hotel_id: hotelId, ...form });
      toast.success('Comentario enviado. Será revisado antes de publicarse.');
      setForm({ name: '', email: '', content: '' });
      setSubmitted(true);
    } catch {
      toast.error('Error al enviar el comentario');
    }
  };

  return (
    <section className="py-12 lg:py-16 bg-white">
      <div className="container-wide" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-serif text-gray-900 mb-6">
            {getConfigValue(configs, 'comments_title', 'Lo que dicen nuestros huéspedes')}
          </h2>
        </motion.div>

        {/* Comments grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {comments.map((comment, index) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 30 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-gray-50 rounded-2xl p-8 border border-gray-100"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`w-5 h-5 ${i < 4 ? 'text-yellow-400' : 'text-gray-200'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 leading-relaxed mb-6">{comment.content}</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-bold">
                  {comment.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{comment.name}</p>
                  <p className="text-gray-400 text-xs">{new Date(comment.created_at).toLocaleDateString('es-BO', { year: 'numeric', month: 'long' })}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Comment form */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-gray-50 rounded-2xl p-8 lg:p-10 border border-gray-100">
            <h3 className="text-2xl font-serif text-gray-900 mb-6 text-center">Deja tu comentario</h3>
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-gray-600">¡Gracias! Tu comentario será revisado antes de publicarse.</p>
                <button onClick={() => setSubmitted(false)} className="mt-4 text-sm text-gray-900 underline">Enviar otro comentario</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Correo *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
                      placeholder="tu@correo.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comentario *</label>
                  <textarea
                    rows={4}
                    required
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all resize-none"
                    placeholder="Comparte tu experiencia..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-gray-900 text-white font-semibold text-sm tracking-wider uppercase hover:bg-gray-800 transition-all duration-300 rounded-lg"
                >
                  Enviar Comentario
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
