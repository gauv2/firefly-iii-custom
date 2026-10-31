{{-- custom: previous / period / next. The arrows click the menu's own prev and next items (js/custom/shell.js) --}}
<li class="nav-item dropdown ff-period" id="date-dropdown">
    <button type="button" class="ff-icon-btn" id="ff-period-prev" aria-label="Previous period" title="Previous period">
        <em class="bi bi-chevron-left" aria-hidden="true"></em>
    </button>
    <a
        href="#"
        class="nav-link ff-period-label"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        id="date-range"
        title="Choose a period"
    >
        <span class="daterange-holder"></span>
        <span class="ff-period-pretty" aria-hidden="true"></span>
        <em class="bi bi-chevron-down ff-period-caret" aria-hidden="true"></em>
    </a>
    <button type="button" class="ff-icon-btn" id="ff-period-next" aria-label="Next period" title="Next period">
        <em class="bi bi-chevron-right" aria-hidden="true"></em>
    </button>
    <ul
        x-data="dates" x-bind="eventListeners"
        class="dropdown-menu"

        aria-labelledby="date-range"
        style="--bs-dropdown-min-width: 8rem"
    >
        <li>
            <a href="#" class="dropdown-item daterange-current" @click="changeDateRange">current</a>
        </li>
        <li>
            <a href="#" @click="changeDateRange" class="dropdown-item daterange-next">next</a>
        </li>
        <li>
            <a href="#" class="dropdown-item daterange-prev" @click="changeDateRange">prev</a>
        </li>
        <li>
            <a href="#" class="dropdown-item daterange-today" @click="changeDateRange">today</a>
        </li>
        <li>
            <a href="#" class="dropdown-item daterange-7d" @click="changeDateRange">{{ __('firefly.last_seven_days') }}</a>
        </li>
        <li>
            <a href="#" class="dropdown-item daterange-30d" @click="changeDateRange">
                {{ __('firefly.last_thirty_days') }}
            </a>
        </li>
        <li>
            <a href="#" class="dropdown-item daterange-mtd" @click="changeDateRange">
                {{ __('firefly.month_to_date') }}
            </a>
        </li>
        <li>
            <a href="#" class="dropdown-item daterange-ytd" @click="changeDateRange">
                {{ __('firefly.year_to_date') }}
            </a>
        </li>
        <li>
            <a href="#" class="dropdown-item" data-bs-toggle="modal" data-bs-target="#customDateRangeModal">
                {{ __('firefly.customRange') }}
            </a>
        </li>
    </ul>
</li>


