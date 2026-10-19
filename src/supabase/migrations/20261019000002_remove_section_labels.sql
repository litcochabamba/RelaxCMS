-- Las etiquetas pequeñas sobre los títulos (eyebrows) se retiran del sitio.
--
-- El diseño queda solo con título y descripción en cada sección y en el hero.
-- Se borran las claves `*_label` de la configuración y se vacían los subtítulos
-- de los slides, que eran la misma etiqueta en mayúsculas sobre el título.
--
-- Los valores por defecto del código ya no las usan: esto limpia las bases que
-- todavía las tengan guardadas.

delete from public.configuracion_hotel
where key like '%\_label' escape '\';

update public.hero_slides
set subtitle = null
where subtitle is not null;
