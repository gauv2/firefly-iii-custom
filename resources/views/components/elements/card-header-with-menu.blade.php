<div class="card-header">
    {{-- custom: title and button wrap as a pair instead of squeezing the button label --}}
    <div class="ff-card-head-row">
        <div>
            <h3 class="card-title">{{ $cardTitle }}</h3>
        </div>
        @if('' !== $route)
        <div class="text-end" role="group">
            <a href="{{ $route }}" class="btn btn-sm btn-outline-success">
                <span class="bi bi-plus-circle"></span> {{ $linkTitle }}
            </a>
        </div>
        @endif
    </div>
</div>
