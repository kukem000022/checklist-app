with title_map(bad_title, good_title) as (
  values
    ('Viá»c cáº§n lÃ m', 'Việc cần làm'),
    ('ViÃ¡Â»Âc cÃ¡ÂºÂ§n lÃÂ m', 'Việc cần làm'),
    ('Äang xá»­ lÃ½', 'Đang xử lý'),
    ('ÃÂang xÃ¡Â»Â­ lÃÂ½', 'Đang xử lý'),
    ('Chá» pháº£n há»i', 'Chờ phản hồi'),
    ('ChÃ¡Â»Â phÃ¡ÂºÂ£n hÃ¡Â»Âi', 'Chờ phản hồi'),
    ('HoÃ n thÃ nh', 'Hoàn thành'),
    ('HoÃÂ n thÃÂ nh', 'Hoàn thành')
)
delete from public.task_lists bad
using title_map
where bad.title = title_map.bad_title
  and exists (
    select 1
    from public.task_lists good
    where good.project_id = bad.project_id
      and good.title = title_map.good_title
  );

update public.task_lists
set title = title_map.good_title
from title_map
where public.task_lists.title = title_map.bad_title;
