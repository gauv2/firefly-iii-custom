# Firefly III Custom

A personal copy of [Firefly III](https://github.com/firefly-iii/firefly-iii) (AGPL-3.0) with a redesigned interface.
`custom` is the default branch; `main` follows upstream.

## What is changed

The look (Blade views and front-end assets) and a few extra pages. Each extra page is one route in
`routes/web.php` and a controller in `app/Http/Controllers/Custom` that only renders a view; its data
goes through upstream's API. The API and the database schema are upstream's.

| Area | Files |
| --- | --- |
| Design tokens and theme (colours, Geist, corners, focus, contrast) | `resources/assets/v3/sass/_custom-theme.scss`, imported at the end of `app.scss` |
| Shell: top bar, period switcher, search, "Add transaction", phone tab bar | `_custom-shell.scss`, `js/custom/shell.js`, `views/layout/v3/session.blade.php`, `views/components/layout/{sidebar,range,create-menu,user-menu}.blade.php` |
| Home page | `views/index.blade.php`, `js/custom/home.js`, `_custom-home.scss` |
| Employer page (payslips, expensing, mobility budget; data in the `customEmployer` preference) | `routes/web.php` (custom: group), `app/Http/Controllers/Custom/EmployerController.php`, `views/custom/employer.blade.php`, `js/custom/employer.js`, `_custom-employer.scss`, a sidebar link |
| Image | `custom/Dockerfile` |

Custom code is kept in its own files where possible, so upstream updates merge with few conflicts.
Changed upstream files carry a `custom:` comment.

## Build

```sh
docker build -f custom/Dockerfile -t firefly-custom:6.7.9 .
```

The image is upstream's `fireflyiii/core:version-6.7.9` with this branch's views and rebuilt assets.
On the VPS, `firefly/custom/build.sh` in the GauravVPS repo does this.

## Updating to a new upstream version

```sh
git fetch upstream --tags
git merge v6.x.y            # into custom
# set FIREFLY_VERSION in custom/Dockerfile to 6.x.y, rebuild, check the custom: files still apply
```
